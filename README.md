# TINFOIL HAT ($TINFOIL)

The cyber incident coin. Part meme, part real utility:

- **Hat generator**: put a tinfoil hat on any profile picture. Runs entirely in the browser; images are never uploaded.
- **Incident monitor**: a live ticker and a filterable feed of real cyber incidents, aggregated from public sources and always linked to the original article.
- **Survival guide**: a practical grid-down preparedness manual based on Ready.gov and Red Cross guidance, with checklists that save to your browser.

The voice is a paranoid conspiracy theorist played for laughs. The incident data and the survival information are real.

## Stack

- TypeScript everywhere
- React + Vite + Tailwind CSS + React Router (client, in `src/`)
- Express (server, in `server/`): serves the JSON API and the built client
- No database: an in-memory cache plus one JSON file on disk (`data/incidents.json`)
- One process: `npm run build` builds everything, `npm start` runs Express

```
src/            React app
  config.ts     ALL token-specific values (name, ticker, contract address, links)
  pages/        Home, HatGenerator, IncidentFeed, SurvivalGuide
  hat/          canvas engine for the hat generator
  data/         survival guide content
server/         Express app, incident poller, API
  sources.ts    the list of incident sources
shared/         types shared by client and server
public/hats/    hat images for the generator (tinfoil-hat.png is the default)
scripts/        generate-og.ts (social card + icons), prepare-hat.ts (make a transparent hat PNG)
data/           incidents.json is written here at runtime (gitignored)
```

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

`npm run dev` starts two things: the Express API on http://localhost:3000 and the Vite dev server on http://localhost:5173 (open this one; it proxies `/api` to Express and hot-reloads).

To run the production build locally:

```bash
npm run build
npm start
```

Then open http://localhost:3000.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks the client and the server |
| `npm test` | Unit tests for the incident pipeline (categorizer, de-duplication, fetchers, API) and the hat placement math |
| `npm run og` | Regenerates `public/og.png`, `public/favicon.png` and `public/apple-touch-icon.png` from the hat image and `src/config.ts` (also runs as part of `npm run build`) |
| `npm run hat:prepare -- <image>` | Turns a photo of a hat on a plain background into a transparent PNG in `public/hats/` |

## Editing `src/config.ts`

Every token-specific value lives in `src/config.ts`:

| Field | Meaning |
| --- | --- |
| `tokenName`, `ticker`, `chain` | Shown across the site, in the page title and on the social card |
| `tagline`, `description` | Hero tagline; SEO and social description |
| `contractAddress` | Shown in the hero with a copy button |
| `links.buy`, `links.chart`, `links.x` | The hero and footer buttons |
| `shareText` | Prefilled text for the hat generator's "Share on X" button |
| `faceDetection` | `true` lets the hat generator try to auto-place the hat with in-browser face detection |

The file ships with obvious placeholders (`PASTE_CONTRACT_ADDRESS_HERE`, `https://example.com/REPLACE_WITH_...`). While a value is still a placeholder the site shows it as "pending" (disabled button, redacted address) instead of linking somewhere broken, so you can deploy before everything is filled in.

After editing, rebuild: `npm run build` (on Replit, press Run again or redeploy). The page title, meta tags and social card are generated from the same file.

## Adding hats

The generator loads every `.png` or `.webp` in `public/hats/`. `tinfoil-hat.png` is always the default. When the folder holds more than one hat, a hat picker appears automatically; with a single hat it stays hidden.

A hat image should be:

- a **transparent** PNG (or WebP), cropped close to the hat
- oriented so the **bottom edge is the brim**, because that edge is placed on the forehead line
- roughly 600 px wide or more, so it stays sharp in the 1000x1000 export

If you only have a photo of a hat on a white or plain background, this makes a transparent, trimmed PNG from it:

```bash
npm run hat:prepare -- path/to/photo.jpg my-hat-name
```

That writes `public/hats/my-hat-name.png`. Options: `--scale 2` (upscale factor), `--tolerance 20` (how aggressively the background is removed), `--preview out.png` (writes a preview on a checkerboard). Rebuild afterwards. To replace the default hat, overwrite `public/hats/tinfoil-hat.png` and run `npm run og` to refresh the social card and icons.

## Incident sources

Sources are defined in `server/sources.ts`. The server polls all of them when it starts and every 5 minutes after that, normalizes each item, tags it with categories by keyword, removes duplicates, keeps the newest 500 and saves them to `data/incidents.json`.

Current sources: CISA Known Exploited Vulnerabilities (JSON), CISA Cybersecurity Advisories, BleepingComputer, The Hacker News, Krebs on Security, The Record, SecurityWeek.

**To add a source**, append an entry:

```ts
{
  id: 'example-news',            // unique, URL-safe
  name: 'Example News',          // credited next to every item
  type: 'rss',                   // any RSS or Atom feed
  url: 'https://example.com/feed/',
  maxItems: 50,                  // newest N items taken per poll
},
```

**To remove a source**, delete its entry. Its existing items age out as newer ones arrive (or delete `data/incidents.json` to clear them immediately).

Each source is fetched in its own try/catch with a timeout, so a dead feed never breaks the others. Check how each one is doing at `/api/status`.

Content rules the pipeline follows: headlines are shown exactly as published, only a short plain-text snippet (200 characters at most) is stored, never the article body, and every item links to and credits its source.

### API

| Endpoint | Returns |
| --- | --- |
| `GET /api/incidents?category=&source=&since=&q=&limit=` | Incidents, newest first. `category` and `source` take names or slugs, comma-separated for OR. `since` takes `24h`, `7d`, `30d`, an ISO date or epoch ms. `limit` is 1 to 500 (default 100). |
| `GET /api/incidents/ticker` | The newest 25 with minimal fields, plus the threat level |
| `GET /api/status` | Last poll time, per-source success or failure, item count |

The THREAT LEVEL is a meme metric derived only from how many incidents the feed picked up in the last 24 hours (thresholds in `shared/threat.ts`). It is not an official rating of anything.

## Deploying on Replit

1. In Replit, create a new app with **Import from GitHub** and choose this repository.
2. Replit reads `.replit`: it provides Node.js 20 and sets the Run command to `npm run build && npm start`. Press **Run**. If dependencies were not installed automatically, run `npm install` once in the Shell and press Run again.
3. The server listens on `process.env.PORT` (falling back to 3000) on `0.0.0.0`; `.replit` maps port 3000 to the public port 80. The site appears in the Webview.
4. To publish, press **Deploy**. The build command (`npm run build`) and run command (`npm start`) come from `.replit`. A **Reserved VM** deployment is the best fit, because the incident poller runs inside the server process and stays warm. Autoscale also works: after an idle period the first visitor triggers a fresh poll and the feed fills in within a few seconds.
5. Fill in `src/config.ts`, commit, pull the change into Replit and redeploy.

Optional environment variables (Replit: Secrets):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `SITE_URL` | derived from the request | Canonical origin for social-card URLs, for example `https://tinfoilhat.example`. Set this once you have a custom domain. |
| `POLL_INTERVAL_MS` | `300000` | How often the sources are polled |
| `FEED_TIMEOUT_MS` | `20000` | Per-source fetch timeout |
| `FEED_USER_AGENT` | a generic reader string | User-Agent sent to the feeds |
| `DATA_DIR` | `./data` | Where `incidents.json` is written |
| `POLL_ON_START` | `true` | Set to `false` to skip the poll that runs at startup |

Notes for Replit:

- Build tools (Vite, TypeScript, Tailwind, esbuild) are listed under `dependencies` on purpose, so the build still works when the host installs with `NODE_ENV=production`.
- `data/incidents.json` is runtime data and is gitignored. A fresh deployment starts with an empty feed and fills it on the first poll, a few seconds after boot.
- Some news sites block requests from cloud IP ranges. If a source shows as failing in `/api/status` on Replit but works locally, that is why; the other sources are unaffected.

## Privacy

No analytics, no cookies, no trackers, and fonts are self-hosted. The "surveillance readout" is a joke built from the browser's user-agent string; nothing is looked up or stored. The hat generator never uploads images. The only third-party request the site can make is the optional face detector (`faceDetection` in `src/config.ts`), which downloads the MediaPipe library and model from public CDNs the first time it runs and then works locally in the browser.

## Disclaimers

$TINFOIL is a memecoin with no intrinsic value and no expectation of financial return. Nothing on the site is financial advice. The incident feed aggregates public reporting and links to the original sources. The survival guide is general preparedness information, not professional advice.
