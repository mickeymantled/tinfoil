import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Incident, IncidentsResponse, StatusResponse, TickerResponse } from '../shared/types';
import { createApp } from './app';
import { Poller } from './poller';
import { parseSince } from './routes';
import { IncidentStore } from './store';
import { hashId } from './text';

const now = Date.now();
function inc(n: number, p: Partial<Incident>): Incident {
  const url = `https://news.example/${n}`;
  return {
    id: hashId(url),
    title: `Headline ${n}`,
    url,
    source: 'BleepingComputer',
    publishedAt: new Date(now - n * 3_600_000).toISOString(),
    snippet: '',
    categories: ['Other'],
    ...p,
  };
}

/** Raw request: lets tests set Host and avoids fetch's automatic Cache-Control on conditional requests. */
function rawGet(base: string, p: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${base}${p}`, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

const TEMPLATE = `<link rel="canonical" href="__SITE_ORIGIN____CANONICAL_PATH__" /><meta property="og:image" content="__SITE_ORIGIN__/og.png" />`;

async function startServer(clientDist: string, siteUrl?: string) {
  const store = new IncidentStore(path.join(clientDist, 'no-data'));
  store.merge([
    inc(1, { title: 'Qilin ransomware hits hospital', categories: ['Ransomware', 'Infrastructure/Grid'] }),
    inc(2, { title: 'Wallet drainer targets Solana users', categories: ['Crypto Hack'], source: 'The Hacker News' }),
    inc(48, { title: 'Old policy story', source: 'The Record' }),
  ]);
  const poller = new Poller({ sources: [], store, intervalMs: 300_000, timeoutMs: 1000, userAgent: 'x' });
  const app = createApp({ store, poller, clientDist, siteUrl });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, base };
}

describe('parseSince', () => {
  it('accepts relative, ISO and epoch ms; rejects junk', () => {
    const t = 1_000_000_000_000;
    assert.equal(parseSince('24h', t), t - 86_400_000);
    assert.equal(parseSince('30m', t), t - 1_800_000);
    assert.equal(parseSince('7d', t), t - 7 * 86_400_000);
    assert.equal(parseSince('2w', t), t - 14 * 86_400_000);
    assert.equal(parseSince('2026-11-01', t), Date.parse('2026-11-01'));
    assert.equal(parseSince('2026-11-01T12:00:00Z', t), Date.parse('2026-11-01T12:00:00Z'));
    assert.equal(parseSince('1762000000000', t), 1762000000000);
    for (const bad of ['yesterday', '24x', '-1d', '2026-13-45', '']) assert.throws(() => parseSince(bad, t));
  });
});

describe('HTTP app', () => {
  let dist: string;
  let srv: Awaited<ReturnType<typeof startServer>>;

  before(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'tinfoil-dist-'));
    await fs.mkdir(path.join(dist, 'assets'));
    await fs.writeFile(path.join(dist, 'index.html'), TEMPLATE);
    await fs.writeFile(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    await fs.writeFile(path.join(dist, 'robots.txt'), 'User-agent: *');
    srv = await startServer(dist);
  });
  after(() => srv.server.close());

  const get = (p: string, headers: Record<string, string> = {}) => fetch(`${srv.base}${p}`, { headers });

  it('GET /api/incidents with filters', async () => {
    const all = (await (await get('/api/incidents')).json()) as IncidentsResponse;
    assert.equal(all.total, 3);
    assert.deepEqual(all.sources, ['BleepingComputer', 'The Hacker News', 'The Record']);
    assert.equal(all.categories.length, 8);
    assert.equal(all.lastPollAt, null);

    const q = async (s: string) => ((await (await get(`/api/incidents?${s}`)).json()) as IncidentsResponse);
    assert.equal((await q('category=ransomware,crypto-hack')).total, 2);
    assert.equal((await q('category=Infrastructure%2FGrid')).total, 1);
    assert.equal((await q('source=the-hacker-news')).items[0].source, 'The Hacker News');
    assert.equal((await q('source=The%20Record,bleepingcomputer')).total, 2);
    assert.equal((await q('source=unknown')).total, 0);
    assert.equal((await q('since=24h')).total, 2);
    assert.equal((await q('q=SOLANA%20wallet')).total, 1);
    const lim = await q('limit=1');
    assert.equal(lim.items.length, 1);
    assert.equal(lim.total, 3);
  });

  it('rejects bad params with 400 JSON', async () => {
    for (const p of ['since=yesterday', 'limit=0', 'limit=501', 'limit=abc', 'category=aliens']) {
      const res = await get(`/api/incidents?${p}`);
      assert.equal(res.status, 400, p);
      const body = (await res.json()) as { error: string };
      assert.ok(body.error.length > 0);
    }
  });

  it('ticker and status', async () => {
    const t = (await (await get('/api/incidents/ticker')).json()) as TickerResponse;
    assert.equal(t.items[0].category, 'Ransomware');
    assert.equal(t.threat.count24h, 2);
    const s = (await (await get('/api/status')).json()) as StatusResponse;
    assert.equal(s.itemCount, 3);
    assert.equal(s.pollIntervalMs, 300_000);
  });

  it('ETag + no-cache, 304 on repeat', async () => {
    const res = await get('/api/incidents/ticker');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    const etag = res.headers.get('etag');
    assert.ok(etag);
    const again = await rawGet(srv.base, '/api/incidents/ticker', { 'If-None-Match': etag });
    assert.equal(again.status, 304);
  });

  it('unknown /api routes are 404 JSON', async () => {
    const res = await get('/api/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  });

  it('security headers, no x-powered-by', async () => {
    const res = await get('/api/status');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('SPA fallback injects origin and path', async () => {
    const res = await rawGet(srv.base, '/incidents?category=ransomware', { Host: 'tinfoil.example:8080' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-cache');
    const html = res.body;
    assert.ok(html.includes('href="http://tinfoil.example:8080/incidents"'), html);
    assert.ok(html.includes('content="http://tinfoil.example:8080/og.png"'));
  });

  it('honours X-Forwarded-Proto/Host and rejects hostile hosts', async () => {
    const fwd = await (await get('/', { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'tinfoil.example' })).text();
    assert.ok(fwd.includes('href="https://tinfoil.example/"'), fwd);
    const evil = (await rawGet(srv.base, '/hat-generator', { Host: 'evil.com"><script>alert(1)</script>' })).body;
    assert.ok(!evil.includes('<script>'));
    assert.ok(evil.includes('href="/hat-generator"'), evil);
  });

  it('known client routes are 200 (with or without trailing slash)', async () => {
    for (const p of ['/', '/hat-generator', '/incidents', '/survival-guide', '/hat-generator/', '/incidents/', '/survival-guide/', '/index.html']) {
      const res = await rawGet(srv.base, p, { Host: 'tinfoil.example' });
      assert.equal(res.status, 200, p);
      const route = p === '/index.html' ? '/' : p.length > 1 ? p.replace(/\/$/, '') : p;
      assert.ok(res.body.includes(`href="http://tinfoil.example${route}"`), `${p}: ${res.body}`);
    }
  });

  it('unknown page paths are 404 with the HTML shell and a root canonical', async () => {
    for (const p of ['/definitely-not-a-page', '/incidents/extra', '/hat-generator//', '/Incidents']) {
      const res = await rawGet(srv.base, p, { Host: 'tinfoil.example' });
      assert.equal(res.status, 404, p);
      assert.match(String(res.headers['content-type']), /text\/html/);
      assert.equal(res.headers['cache-control'], 'no-cache');
      assert.ok(res.body.includes('href="http://tinfoil.example/"'), `${p}: ${res.body}`);
      assert.ok(!res.body.includes(p.slice(1)), p);
    }
    // API and file-extension behaviour unchanged.
    const api = await rawGet(srv.base, '/api/definitely-not-a-page');
    assert.equal(api.status, 404);
    assert.deepEqual(JSON.parse(api.body), { error: 'Not found' });
    const file = await rawGet(srv.base, '/definitely-not-a-page.png');
    assert.equal(file.status, 404);
    assert.equal(file.body, 'Not found\n');
  });

  it('escapes the path in attributes', async () => {
    const res = await fetch(`${srv.base}/a%22b'c`);
    const html = await res.text();
    assert.ok(!html.includes(`/a"b`));
    assert.ok(!html.includes(`b'c`));
  });

  it('serves static files with cache headers; missing files with an extension are 404', async () => {
    const asset = await get('/assets/app-abc123.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control') ?? '', /immutable/);
    const robots = await get('/robots.txt');
    assert.equal(robots.headers.get('cache-control'), 'public, max-age=600');
    assert.equal((await get('/missing.png')).status, 404);
    assert.equal((await get('/assets/missing.js')).status, 404);
    const raw = await (await get('/index.html')).text();
    assert.ok(!raw.includes('__SITE_ORIGIN__'));
  });

  it('SITE_URL wins and dist missing gives a 503 but the API still works', async () => {
    const other = await startServer(path.join(dist, 'does-not-exist'), 'https://tinfoilhat.example/');
    try {
      const res = await fetch(`${other.base}/`);
      assert.equal(res.status, 503);
      assert.match(await res.text(), /npm run build/);
      assert.equal((await fetch(`${other.base}/api/status`)).status, 200);
    } finally {
      other.server.close();
    }
    const withSite = await startServer(dist, 'https://tinfoilhat.example/');
    try {
      const html = await (await fetch(`${withSite.base}/survival-guide`)).text();
      assert.ok(html.includes('href="https://tinfoilhat.example/survival-guide"'), html);
    } finally {
      withSite.server.close();
    }
  });
});
