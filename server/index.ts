/**
 * TINFOIL HAT server: incident poller + JSON API + the built client.
 *
 * Paths resolve from process.cwd() (the repo root), because in production this
 * file is bundled to dist-server/index.js and started from the repo root.
 *
 * Env: PORT, SITE_URL, CLIENT_DIST, DATA_DIR, POLL_INTERVAL_MS, POLL_ON_START,
 * FEED_TIMEOUT_MS, FEED_USER_AGENT.
 */
import path from 'node:path';
import { createApp } from './app';
import { DEFAULT_USER_AGENT } from './fetchers';
import { Poller } from './poller';
import { SOURCES } from './sources';
import { IncidentStore } from './store';

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) {
    console.warn(`[config] ignoring invalid ${name}=${raw}; using ${fallback}`);
    return fallback;
  }
  return Math.floor(n);
}

const cwd = process.cwd();
const port = intEnv('PORT', 3000, 0);
const dataDir = path.resolve(cwd, process.env.DATA_DIR || 'data');
const clientDist = path.resolve(cwd, process.env.CLIENT_DIST || 'dist');
const pollIntervalMs = intEnv('POLL_INTERVAL_MS', 300_000, 10_000);
const feedTimeoutMs = intEnv('FEED_TIMEOUT_MS', 20_000, 1_000);
const pollOnStart = !/^(0|false|no|off)$/i.test((process.env.POLL_ON_START ?? 'true').trim());
const userAgent = process.env.FEED_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
const siteUrl = process.env.SITE_URL?.trim() || undefined;
const startedAt = new Date().toISOString();

const store = new IncidentStore(dataDir);
const loaded = await store.load();
console.log(`[store] loaded ${loaded} incidents from ${store.file}`);

const poller = new Poller({ sources: SOURCES, store, intervalMs: pollIntervalMs, timeoutMs: feedTimeoutMs, userAgent });
// Data from before a restart is as fresh as the poll that saved it.
if (loaded > 0) poller.lastPollAt = store.loadedSavedAt;

const app = createApp({ store, poller, clientDist, siteUrl, startedAt });
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[http] listening on http://0.0.0.0:${port} (client: ${clientDist})`);
  // Started after listen so the first (slow) poll never delays the port opening.
  poller.start(pollOnStart);
});
server.on('error', (err) => {
  console.error(`[http] server error: ${err.message}`);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[http] ${signal} received, shutting down`);
  poller.stop();
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
