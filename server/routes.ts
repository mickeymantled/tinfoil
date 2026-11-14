import express, { type NextFunction, type Request, type Response } from 'express';
import { computeThreat, countLast24h } from '../shared/threat';
import {
  CATEGORIES,
  slugify,
  type Category,
  type IncidentsResponse,
  type StatusResponse,
  type TickerItem,
  type TickerResponse,
} from '../shared/types';
import type { Poller } from './poller';
import { queryIncidents, type IncidentStore } from './store';

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
export const TICKER_SIZE = 25;

class BadRequest extends Error {
  status = 400;
}

const UNIT_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** Parses `since`: relative (`90m`, `24h`, `7d`, `2w`), ISO date/time, or epoch milliseconds. */
export function parseSince(raw: string, now = Date.now()): number {
  const s = raw.trim();
  const rel = /^(\d{1,6})\s*([mhdw])$/i.exec(s);
  if (rel) return now - Number(rel[1]) * UNIT_MS[rel[2].toLowerCase()];
  if (/^\d{1,15}$/.test(s)) return Number(s);
  if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/i.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  throw new BadRequest(`Invalid "since": use a relative value like 24h, 7d or 30d, an ISO date, or epoch milliseconds.`);
}

export function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_LIMIT;
  const s = raw.trim();
  if (!/^\d{1,4}$/.test(s) || Number(s) < 1 || Number(s) > MAX_LIMIT) {
    throw new BadRequest(`Invalid "limit": use a whole number from 1 to ${MAX_LIMIT}.`);
  }
  return Number(s);
}

const CATEGORY_BY_KEY = new Map<string, Category>();
for (const c of CATEGORIES) {
  CATEGORY_BY_KEY.set(slugify(c), c);
  CATEGORY_BY_KEY.set(c.toLowerCase(), c);
}

export function parseCategories(raw: string): Category[] {
  const out = new Set<Category>();
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const c = CATEGORY_BY_KEY.get(part.toLowerCase()) ?? CATEGORY_BY_KEY.get(slugify(part));
    if (!c) {
      throw new BadRequest(`Unknown category "${part.slice(0, 60)}". Valid: ${CATEGORIES.map(slugify).join(', ')}.`);
    }
    out.add(c);
  }
  return [...out];
}

/** Query values may arrive as arrays (`?category=a&category=b`); join them as a comma list. */
function param(req: Request, name: string): string | undefined {
  const v = (req.query as Record<string, unknown>)[name];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(',');
  return undefined;
}

export function createApiRouter(store: IncidentStore, poller: Poller, startedAt: string): express.Router {
  const router = express.Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  const sourceNames = () => [...new Set(store.all().map((i) => i.source))].sort((a, b) => a.localeCompare(b));
  const threat = () => computeThreat(countLast24h(store.all().map((i) => i.publishedAt)));

  router.get('/incidents', (req, res) => {
    const limit = parseLimit(param(req, 'limit'));
    const sinceRaw = param(req, 'since');
    const sinceMs = sinceRaw && sinceRaw.trim() ? parseSince(sinceRaw) : undefined;
    const catRaw = param(req, 'category');
    const categories = catRaw ? parseCategories(catRaw) : undefined;

    let sources: string[] | undefined;
    const srcRaw = param(req, 'source');
    const wanted = (srcRaw ?? '').split(',').map((s) => slugify(s)).filter(Boolean);
    if (wanted.length) {
      const known = sourceNames();
      // Unknown sources simply match nothing.
      sources = known.filter((name) => wanted.includes(slugify(name)));
    }

    const q = (param(req, 'q') ?? '').slice(0, 200).toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    const result = queryIncidents(store.all(), { categories, sources, sinceMs, words, limit });
    const body: IncidentsResponse = {
      items: result.items,
      total: result.total,
      sources: sourceNames(),
      categories: CATEGORIES,
      lastPollAt: poller.lastPollAt,
    };
    res.json(body);
  });

  router.get('/incidents/ticker', (_req, res) => {
    const items: TickerItem[] = store
      .all()
      .slice(0, TICKER_SIZE)
      .map((i) => ({
        id: i.id,
        title: i.title,
        url: i.url,
        source: i.source,
        publishedAt: i.publishedAt,
        category: i.categories[0] ?? 'Other',
      }));
    const body: TickerResponse = { items, threat: threat(), lastPollAt: poller.lastPollAt };
    res.json(body);
  });

  router.get('/status', (_req, res) => {
    const sources = poller.sourceStatuses();
    const body: StatusResponse = {
      // Healthy unless every source failed its most recent attempt.
      ok: !sources.every((s) => s.ok === false),
      startedAt,
      polling: poller.polling,
      pollIntervalMs: poller.intervalMs,
      lastPollAt: poller.lastPollAt,
      nextPollAt: poller.nextPollAt,
      itemCount: store.size,
      threat: threat(),
      sources,
    };
    res.json(body);
  });

  router.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Express 5 forwards thrown errors (sync and async) here.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ error: err instanceof BadRequest ? err.message : 'Bad request' });
      return;
    }
    console.error('[api] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return router;
}
