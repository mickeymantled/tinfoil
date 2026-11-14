/**
 * generate-og: renders the social card and icons from the hat PNG + site config.
 *
 *   npm run og            (first step of `npm run build`)
 *
 * Writes public/og.png (1200x630), public/favicon.png (64x64) and
 * public/apple-touch-icon.png (180x180). Text is laid out by satori with fonts
 * loaded from @fontsource (no system fonts needed) and rasterized by resvg.
 *
 * This script must never fail the build: every error is logged as a one-line
 * warning, the process exits 0, and existing output files are left untouched.
 * HAT_PATH=<file> overrides the hat image (used to test the missing-hat path).
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config';

const ROOT = process.cwd();
const HAT_PATH = path.resolve(ROOT, process.env.HAT_PATH || 'public/hats/tinfoil-hat.png');
const OUT = {
  og: path.join(ROOT, 'public/og.png'),
  favicon: path.join(ROOT, 'public/favicon.png'),
  apple: path.join(ROOT, 'public/apple-touch-icon.png'),
};

const C = {
  bg: '#080b08',
  ink800: '#0e130e',
  phosphor: '#3dff7a',
  phosphorDim: '#1fa64d',
  phosphorDark: '#0f5c2a',
  amber: '#ffb000',
  alert: '#ff2e2e',
  alertDim: '#b01717',
  body: '#c9d8c9',
  stamp: '#b3201c',
  white: '#ffffff',
};

const W = 1200;
const H = 630;
const HAT_W = 643;
const HAT_H = 540;

type Style = Record<string, string | number>;
interface El {
  type: string;
  props: { style?: Style; children?: Child | Child[]; [key: string]: unknown };
}
type Child = El | string;

function h(type: string, props: { style?: Style; [key: string]: unknown } | null, ...children: Child[]): El {
  const kids = children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
  return { type, props: { ...(props ?? {}), children: kids } };
}

function warn(msg: string): void {
  console.warn(`[og] WARNING: ${msg}`);
}

function readFont(rel: string): Buffer {
  return fs.readFileSync(path.join(ROOT, 'node_modules', rel));
}

function writePng(file: string, png: Buffer, size: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`[og] wrote ${path.relative(ROOT, file)} (${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

/** Thin L-shaped corner bracket, like a viewfinder mark. */
function bracket(pos: { top?: number; bottom?: number; left?: number; right?: number }): El {
  const len = 34;
  const t = 4;
  const style: Style = { position: 'absolute', width: len, height: len, ...pos };
  if (pos.top !== undefined) style.borderTop = `${t}px solid ${C.phosphor}`;
  if (pos.bottom !== undefined) style.borderBottom = `${t}px solid ${C.phosphor}`;
  if (pos.left !== undefined) style.borderLeft = `${t}px solid ${C.phosphor}`;
  if (pos.right !== undefined) style.borderRight = `${t}px solid ${C.phosphor}`;
  return h('div', { style });
}

function buildCard(hatUri: string | null): El {
  const mono = 'IBM Plex Mono';
  const crt = 'VT323';
  const chainLabel = `REC  //  CYBER INCIDENT COIN ON ${config.chain.toUpperCase()}`;
  // VT323 glyphs advance about 0.4em; shrink the name if its longest word would overflow the column.
  const longestWord = Math.max(...config.tokenName.split(/\s+/).map((w) => w.length), 1);
  const nameSize = Math.min(156, Math.floor(620 / (longestWord * 0.41)));

  const background = h('div', {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: W,
      height: H,
      backgroundImage:
        'linear-gradient(rgba(61,255,122,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(61,255,122,0.08) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    },
  });
  const scanlines = h('div', {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: W,
      height: H,
      backgroundImage: 'linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.22) 50%)',
      backgroundSize: '100% 4px',
    },
  });
  const vignette = h('div', {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: W,
      height: H,
      backgroundImage: 'radial-gradient(ellipse at 35% 45%, rgba(8,11,8,0) 50%, rgba(2,3,2,0.7) 100%)',
    },
  });

  const topLabel = h(
    'div',
    { style: { display: 'flex', alignItems: 'center', fontFamily: mono, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: C.phosphorDim } },
    h('div', { style: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.alert, marginRight: 14, boxShadow: `0 0 12px ${C.alert}` } }),
    chainLabel,
  );

  const name = h(
    'div',
    {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        fontFamily: crt,
        fontSize: nameSize,
        lineHeight: 0.84,
        color: C.phosphor,
        textShadow: `0 0 24px rgba(61,255,122,0.55), 0 0 4px rgba(61,255,122,0.8)`,
        marginTop: 22,
        marginLeft: -5,
      },
    },
    config.tokenName.toUpperCase(),
  );

  const ticker = h(
    'div',
    {
      style: {
        display: 'flex',
        fontFamily: crt,
        fontSize: 76,
        lineHeight: 1,
        color: C.amber,
        textShadow: '0 0 18px rgba(255,176,0,0.45)',
        marginTop: 12,
      },
    },
    config.ticker,
  );

  const tagline = h(
    'div',
    { style: { display: 'flex', fontFamily: mono, fontSize: 30, lineHeight: 1.32, color: C.body, marginTop: 14, maxWidth: 620 } },
    config.tagline,
  );

  const left = h(
    'div',
    { style: { position: 'absolute', top: 50, left: 64, width: 640, display: 'flex', flexDirection: 'column' } },
    topLabel,
    name,
    ticker,
    tagline,
  );

  // Evidence frame for the hat, right column.
  const frameW = 400;
  const frameH = 380;
  const frameLeft = 736;
  const frameTop = 74;
  const hatW = 340;
  const hatH = Math.round((hatW * HAT_H) / HAT_W);

  const frameChildren: Child[] = [
    h('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: frameW,
        height: frameH,
        backgroundImage: 'radial-gradient(circle at 50% 55%, rgba(61,255,122,0.30) 0%, rgba(61,255,122,0.08) 45%, rgba(61,255,122,0) 70%)',
      },
    }),
    bracket({ top: 0, left: 0 }),
    bracket({ top: 0, right: 0 }),
    bracket({ bottom: 0, left: 0 }),
    bracket({ bottom: 0, right: 0 }),
  ];
  if (hatUri) {
    frameChildren.push(
      h('img', {
        src: hatUri,
        width: hatW,
        height: hatH,
        style: { position: 'absolute', left: (frameW - hatW) / 2, top: (frameH - hatH) / 2 + 14, width: hatW, height: hatH },
      }),
    );
  }
  const frame = h(
    'div',
    { style: { position: 'absolute', left: frameLeft, top: frameTop, width: frameW, height: frameH, display: 'flex' } },
    ...frameChildren,
  );

  const exhibitLabel = h(
    'div',
    {
      style: {
        position: 'absolute',
        left: frameLeft,
        top: frameTop + frameH + 12,
        width: frameW,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 20,
        color: C.phosphor,
      },
    },
    h('div', { style: { display: 'flex', backgroundColor: C.phosphor, color: C.bg, padding: '3px 12px', letterSpacing: 2, whiteSpace: 'pre' } }, 'EXHIBIT A'),
    h('div', { style: { display: 'flex', color: C.phosphorDim, padding: '3px 0', letterSpacing: 2, whiteSpace: 'pre' } }, 'UNDER OBSERVATION'),
  );

  const stamp = h(
    'div',
    {
      style: {
        position: 'absolute',
        left: 800,
        top: 40,
        display: 'flex',
        padding: 5,
        border: `5px solid ${C.alert}`,
        borderRadius: 8,
        transform: 'rotate(-8deg)',
        opacity: 0.88,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          border: `2px solid ${C.alert}`,
          borderRadius: 4,
          padding: '4px 18px 0',
          fontFamily: 'Special Elite',
          fontSize: 44,
          letterSpacing: 4,
          color: C.alert,
          backgroundColor: 'rgba(8,11,8,0.55)',
        },
      },
      'CLASSIFIED',
    ),
  );

  const chyronH = 70;
  const chyron = h(
    'div',
    {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: W,
        height: chyronH,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: C.alertDim,
        borderTop: `3px solid ${C.alert}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          paddingLeft: 64,
          paddingRight: 26,
          backgroundColor: C.alert,
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 4,
          color: C.white,
        },
      },
      h('div', { style: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.white, marginRight: 12 } }),
      'LIVE',
    ),
    h(
      'div',
      { style: { display: 'flex', paddingLeft: 24, fontFamily: mono, fontWeight: 700, fontSize: 22, letterSpacing: 1, color: C.white } },
      'INCIDENT MONITOR  //  HAT GENERATOR  //  GRID-DOWN SURVIVAL GUIDE',
    ),
  );

  return h(
    'div',
    { style: { width: W, height: H, display: 'flex', position: 'relative', backgroundColor: C.bg } },
    background,
    scanlines,
    vignette,
    // Text-only card when the hat is missing: no empty evidence frame.
    ...(hatUri ? [frame, exhibitLabel] : []),
    left,
    stamp,
    chyron,
  );
}

function iconSvg(size: number, hatUri: string, pad: number, bg: string | null): string {
  const inner = size - pad * 2;
  const rect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    rect +
    `<image href="${hatUri}" x="${pad}" y="${pad}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid meet"/>` +
    `</svg>`
  );
}

async function main(): Promise<void> {
  const { default: satori } = await import('satori');
  const { Resvg } = await import('@resvg/resvg-js');

  let hatUri: string | null = null;
  if (fs.existsSync(HAT_PATH)) {
    hatUri = `data:image/png;base64,${fs.readFileSync(HAT_PATH).toString('base64')}`;
  } else {
    warn(`hat image not found at ${path.relative(ROOT, HAT_PATH) || HAT_PATH}; rendering a text-only og.png and skipping the icons`);
  }

  const fonts = [
    { name: 'VT323', data: readFont('@fontsource/vt323/files/vt323-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    { name: 'Special Elite', data: readFont('@fontsource/special-elite/files/special-elite-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: readFont('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: readFont('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
  ];

  // satori's types expect a ReactNode; a plain {type, props} tree is what it walks at runtime.
  const svg = await satori(buildCard(hatUri) as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts });
  const outputs: Array<{ file: string; png: Buffer; size: string }> = [
    { file: OUT.og, png: new Resvg(svg, { fitTo: { mode: 'width', value: W }, background: C.bg }).render().asPng(), size: `${W}x${H}` },
  ];

  if (hatUri) {
    const fav = new Resvg(iconSvg(64, hatUri, 3, null), { fitTo: { mode: 'width', value: 64 } }).render().asPng();
    const apple = new Resvg(iconSvg(180, hatUri, 24, C.bg), { fitTo: { mode: 'width', value: 180 } }).render().asPng();
    outputs.push({ file: OUT.favicon, png: fav, size: '64x64' }, { file: OUT.apple, png: apple, size: '180x180' });
  }

  // Render everything before writing anything, so a late failure leaves all old files intact.
  for (const o of outputs) writePng(o.file, o.png, o.size);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`image generation skipped (${msg.split('\n')[0]}); existing files left untouched`);
    process.exit(0);
  },
);
