/**
 * prepare-hat: turn a photo of a hat on a plain, light background into a
 * trimmed, transparent PNG that the hat generator can use.
 *
 *   npm run hat:prepare -- <input.jpg|png> [output-name] [--scale 2] [--tolerance 20] [--preview out.png]
 *
 * Output goes to public/hats/<output-name>.png (default name: tinfoil-hat).
 *
 * How it works: the background colour is sampled from the image border, the
 * background is flood-filled inwards from the edges (so bright highlights
 * inside the hat are never punched out), and the edge pixels get a soft alpha
 * with the background colour removed so there is no white halo.
 */
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

interface Img {
  w: number;
  h: number;
  data: Float32Array; // RGBA, 0..255
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1] ?? '';
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function decode(file: string): Img {
  const buf = fs.readFileSync(file);
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (isPng) {
    const png = PNG.sync.read(buf);
    return { w: png.width, h: png.height, data: Float32Array.from(png.data) };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { w: img.width, h: img.height, data: Float32Array.from(img.data) };
}

/** Catmull-Rom weight (bicubic, a = -0.5). */
function cubic(x: number): number {
  const a = -0.5;
  const ax = Math.abs(x);
  if (ax <= 1) return (a + 2) * ax ** 3 - (a + 3) * ax ** 2 + 1;
  if (ax < 2) return a * ax ** 3 - 5 * a * ax ** 2 + 8 * a * ax - 4 * a;
  return 0;
}

/** Separable bicubic upscale. Only intended for scale >= 1. */
function upscale(src: Img, scale: number): Img {
  if (scale <= 1) return src;
  const dw = Math.round(src.w * scale);
  const dh = Math.round(src.h * scale);

  // horizontal pass: src.w x src.h -> dw x src.h
  const mid = new Float32Array(dw * src.h * 4);
  for (let x = 0; x < dw; x++) {
    const sx = (x + 0.5) / scale - 0.5;
    const x0 = Math.floor(sx);
    const taps: Array<[number, number]> = [];
    for (let k = -1; k <= 2; k++) {
      const xi = Math.min(src.w - 1, Math.max(0, x0 + k));
      taps.push([xi, cubic(sx - (x0 + k))]);
    }
    for (let y = 0; y < src.h; y++) {
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (const [xi, wgt] of taps) v += src.data[(y * src.w + xi) * 4 + c] * wgt;
        mid[(y * dw + x) * 4 + c] = v;
      }
    }
  }

  // vertical pass: dw x src.h -> dw x dh
  const out = new Float32Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.floor(sy);
    const taps: Array<[number, number]> = [];
    for (let k = -1; k <= 2; k++) {
      const yi = Math.min(src.h - 1, Math.max(0, y0 + k));
      taps.push([yi, cubic(sy - (y0 + k))]);
    }
    for (let x = 0; x < dw; x++) {
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (const [yi, wgt] of taps) v += mid[(yi * dw + x) * 4 + c] * wgt;
        out[(y * dw + x) * 4 + c] = Math.min(255, Math.max(0, v));
      }
    }
  }
  return { w: dw, h: dh, data: out };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Dilate a binary mask by `r` pixels (chebyshev), separably. */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w && mask[y * w + xx]) v = 1;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function invert(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
  return out;
}

function cutout(img: Img, tolerance: number, scale: number): Img {
  const { w, h, data } = img;
  const n = w * h;

  // 1. background colour = median of the border pixels
  const border: number[][] = [[], [], []];
  const pushPx = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    border[0].push(data[i]);
    border[1].push(data[i + 1]);
    border[2].push(data[i + 2]);
  };
  for (let x = 0; x < w; x++) {
    pushPx(x, 0);
    pushPx(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushPx(0, y);
    pushPx(w - 1, y);
  }
  const bg = border.map(median);

  // 2. per-pixel distance from the background colour
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    dist[p] = Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
  }

  // 3. flood-fill the background in from the image border
  const isBg = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (p: number) => {
    if (!isBg[p] && dist[p] <= tolerance) {
      isBg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  // 4. morphological opening of the background: undo thin "leaks" where the
  //    flood crept into a bright highlight on the hat's silhouette.
  const r = Math.max(1, Math.round(1.5 * scale));
  const eroded = invert(dilate(invert(isBg), w, h, r));
  const opened = dilate(eroded, w, h, r);
  for (let p = 0; p < n; p++) if (!opened[p]) isBg[p] = 0;

  // 5. soft alpha in a thin band along the edge, with background removed
  const band = dilate(isBg, w, h, Math.max(1, Math.round(scale)));
  const softLo = tolerance * 0.5;
  const softHi = 96;
  const out = new Float32Array(n * 4);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    let a = 1;
    if (isBg[p]) a = 0;
    else if (band[p]) a = Math.min(1, Math.max(0, (dist[p] - softLo) / (softHi - softLo)));
    if (a <= 0) continue; // fully transparent, leave zeros
    for (let c = 0; c < 3; c++) {
      const v = a < 1 ? (data[i + c] - (1 - a) * bg[c]) / a : data[i + c];
      out[i + c] = Math.min(255, Math.max(0, v));
    }
    out[i + 3] = a * 255;
  }
  return { w, h, data: out };
}

function trim(img: Img, pad: number): Img {
  let minX = img.w;
  let minY = img.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[(y * img.w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('Nothing left after background removal. Try a lower --tolerance.');
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(img.w - 1, maxX + pad);
  maxY = Math.min(img.h - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y + minY) * img.w + minX) * 4;
    out.set(img.data.subarray(from, from + w * 4), y * w * 4);
  }
  return { w, h, data: out };
}

function writePng(img: Img, file: string) {
  const png = new PNG({ width: img.w, height: img.h });
  for (let i = 0; i < img.data.length; i++) png.data[i] = Math.round(img.data[i]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 6 }));
}

/** Debug helper: composite onto a dark checkerboard so edges are easy to judge. */
function preview(img: Img): Img {
  const out = new Float32Array(img.data.length);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      const check = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      const base = check ? [12, 60, 30] : [90, 12, 40];
      const a = img.data[i + 3] / 255;
      for (let c = 0; c < 3; c++) out[i + c] = img.data[i + c] * a + base[c] * (1 - a);
      out[i + 3] = 255;
    }
  }
  return { w: img.w, h: img.h, data: out };
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const input = positional[0];
  if (!input) {
    console.error('Usage: npm run hat:prepare -- <input.jpg|png> [output-name] [--scale 2] [--tolerance 20] [--preview out.png]');
    process.exit(1);
  }
  const name = (positional[1] ?? 'tinfoil-hat').replace(/\.png$/i, '');
  const scale = Number(flags.scale ?? 2);
  const tolerance = Number(flags.tolerance ?? 20);

  const src = decode(input);
  const big = upscale(src, scale);
  const cut = trim(cutout(big, tolerance, scale), 2);
  const outFile = path.resolve('public/hats', `${name}.png`);
  writePng(cut, outFile);
  console.log(`[prepare-hat] ${path.basename(input)} ${src.w}x${src.h} -> ${path.relative(process.cwd(), outFile)} ${cut.w}x${cut.h}`);
  if (flags.preview) {
    writePng(preview(cut), path.resolve(flags.preview));
    console.log(`[prepare-hat] preview written to ${flags.preview}`);
  }
}

main();
