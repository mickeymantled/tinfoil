import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express, { type Request } from 'express';
import type { Poller } from './poller';
import { createApiRouter } from './routes';
import type { IncidentStore } from './store';

export interface AppOptions {
  store: IncidentStore;
  poller: Poller;
  /** Absolute path of the built client (Vite output). */
  clientDist: string;
  /** Public origin from env SITE_URL, if set. */
  siteUrl?: string;
  startedAt?: string;
}

// hostname (labels) or bracketed IPv6, optional :port. Anything else is not reflected into HTML.
const HOST_RE =
  /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*|\[[0-9a-f:.]{2,45}\])(?::\d{1,5})?$/i;

export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Site origin for absolute URLs in index.html, or '' (relative URLs) when it cannot be trusted. */
export function siteOrigin(req: Request, siteUrl?: string): string {
  if (siteUrl) return siteUrl.trim().replace(/\/+$/, '');
  const forwarded = req.get('x-forwarded-host');
  const host = (forwarded ? forwarded.split(',')[0] : req.get('host') ?? '').trim();
  if (!host || host.length > 260 || !HOST_RE.test(host)) return '';
  const proto = req.protocol; // honours X-Forwarded-Proto because trust proxy is on
  if (proto !== 'http' && proto !== 'https') return '';
  return `${proto}://${host.toLowerCase()}`;
}

export function renderIndex(template: string, origin: string, canonicalPath: string): string {
  return template
    .replaceAll('__SITE_ORIGIN__', () => escapeAttr(origin))
    .replaceAll('__CANONICAL_PATH__', () => escapeAttr(canonicalPath));
}

/**
 * Client routes that exist. MUST match the routes in src/App.tsx. Any other
 * extension-less path still gets the SPA shell (the client renders its
 * NotFound page) but with HTTP 404 and a canonical URL pointing at the root.
 */
export const CLIENT_ROUTES = ['/', '/hat-generator', '/incidents', '/survival-guide'] as const;

/** The known client route for a request path ('/index.html' and one trailing slash allowed), or null. */
export function matchClientRoute(reqPath: string): string | null {
  if (reqPath === '/index.html') return '/';
  const p = reqPath.length > 1 ? reqPath.replace(/\/$/, '') : reqPath;
  return (CLIENT_ROUTES as readonly string[]).includes(p) ? p : null;
}

export function createApp(opts: AppOptions): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(compression());
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', createApiRouter(opts.store, opts.poller, opts.startedAt ?? new Date().toISOString()));

  const dist = opts.clientDist;
  const indexFile = path.join(dist, 'index.html');

  const sendIndex = async (req: Request, res: express.Response) => {
    let template: string;
    try {
      template = await fs.promises.readFile(indexFile, 'utf8');
    } catch {
      res
        .status(503)
        .type('text/plain')
        .set('Cache-Control', 'no-store')
        .send('The client has not been built yet. Run `npm run build` to build it.\n');
      return;
    }
    const route = matchClientRoute(req.path);
    // Never advertise a bad path as canonical.
    const canonical = route ?? '/';
    res
      .status(route ? 200 : 404)
      .type('html')
      .set('Cache-Control', 'no-cache')
      .send(renderIndex(template, siteOrigin(req, opts.siteUrl), canonical));
  };

  // index.html is a template; never serve the raw file.
  app.get('/index.html', (req, res, next) => {
    sendIndex(req, res).catch(next);
  });

  app.use(
    express.static(dist, {
      index: false,
      redirect: false,
      setHeaders(res, filePath) {
        const rel = path.relative(dist, filePath).split(path.sep).join('/');
        res.setHeader(
          'Cache-Control',
          rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=600',
        );
      },
    }),
  );

  // SPA fallback (Express 5 has no bare '*' route, so this is a plain middleware).
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (path.posix.extname(req.path) !== '') {
      res.status(404).type('text/plain').send('Not found\n');
      return;
    }
    sendIndex(req, res).catch(next);
  });

  app.use((_req: Request, res: express.Response) => {
    res.status(404).type('text/plain').send('Not found\n');
  });

  app.use((err: unknown, _req: Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).type('text/plain').send('Bad request\n');
      return;
    }
    console.error('[http] error:', err);
    res.status(500).type('text/plain').send('Internal server error\n');
  });

  return app;
}
