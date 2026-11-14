import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { config as site } from './src/config';

const HATS_DIR = path.resolve(__dirname, 'public/hats');
const DEFAULT_HAT = 'tinfoil-hat.png';

/** Installed MediaPipe version, so the face detector's CDN files always match the bundled library. */
const MEDIAPIPE_VERSION: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'),
).version;

/** Lists the image files in public/hats, default hat first. */
function listHats() {
  if (!fs.existsSync(HATS_DIR)) return [];
  return fs
    .readdirSync(HATS_DIR)
    .filter((f) => /\.(png|webp)$/i.test(f) && !f.startsWith('.'))
    .sort((a, b) => (a === DEFAULT_HAT ? -1 : b === DEFAULT_HAT ? 1 : a.localeCompare(b)))
    .map((file) => ({
      file,
      url: `/hats/${encodeURIComponent(file)}`,
      name: file
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
}

/**
 * `import hats from 'virtual:hats'` gives the list of hats found in
 * public/hats at build time (and live in dev). Drop a new transparent PNG in
 * that folder and it shows up in the generator's hat picker.
 */
function hatsPlugin(): Plugin {
  const virtualId = 'virtual:hats';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'tinfoil-hats',
    resolveId(id) {
      return id === virtualId ? resolvedId : undefined;
    },
    load(id) {
      return id === resolvedId ? `export default ${JSON.stringify(listHats())};` : undefined;
    },
    configureServer(server) {
      const refresh = (file: string) => {
        if (!file.startsWith(HATS_DIR)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(HATS_DIR);
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

/** Fills the {{placeholders}} in index.html from src/config.ts. */
function siteMetaPlugin(): Plugin {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const values: Record<string, string> = {
    TOKEN_NAME: site.tokenName,
    TICKER: site.ticker,
    TAGLINE: site.tagline,
    DESCRIPTION: site.description,
    TITLE: `${site.tokenName} (${site.ticker}) | The Cyber Incident Coin`,
  };
  return {
    name: 'tinfoil-site-meta',
    transformIndexHtml(html, ctx) {
      let out = html.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        key in values ? escapeHtml(values[key]) : match,
      );
      // In production Express fills these per request. The Vite dev server
      // has no such step, so fall back to relative URLs there.
      if (ctx.server) {
        out = out.replace(/__SITE_ORIGIN__/g, '').replace(/__CANONICAL_PATH__/g, '/');
      }
      return out;
    },
  };
}

export default defineConfig({
  plugins: [react(), hatsPlugin(), siteMetaPlugin()],
  define: {
    __MEDIAPIPE_VERSION__: JSON.stringify(MEDIAPIPE_VERSION),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
