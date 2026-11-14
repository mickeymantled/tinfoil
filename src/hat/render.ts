/**
 * Canvas drawing for the hat generator. No React.
 *
 * drawScene() draws exactly what gets exported. drawGuides() adds handles and
 * the circle-crop guide on the visible canvas only.
 */
import type { LoadedHat } from './assets';
import {
  CANVAS_SIZE,
  ROTATE_HANDLE_OFFSET_CSS,
  brimCenter,
  handlePositions,
  hatSize,
  type HandleId,
  type HatTransform,
  type Vec,
} from './geometry';

export type FitMode = 'cover' | 'contain';

export interface Overlays {
  scanlines: boolean;
  stamp: boolean;
  laser: boolean;
}

export interface EyeState {
  left: Vec;
  right: Vec;
  /** Flare core radius, canvas px. */
  size: number;
}

export interface SceneState {
  /** Fitted subject, CANVAS_SIZE square. Null before an image is loaded. */
  subject: HTMLCanvasElement | null;
  hat: LoadedHat | null;
  transform: HatTransform;
  overlays: Overlays;
  eyes: EyeState;
}

export type ActiveTarget = HandleId | 'move' | 'eye-left' | 'eye-right' | 'pinch' | null;

export interface GuideOptions {
  /** Canvas px per CSS px of the displayed canvas. */
  cssScale: number;
  circleGuide: boolean;
  showHandles: boolean;
  active: ActiveTarget;
}

const EMPTY_BG = '#0b100c';
const CONTAIN_BG = '#0b100c';

/** Stamp layout on the 1000px canvas: low and centered, so it stays off the face. */
const STAMP_CENTER: Vec = { x: 500, y: 865 };
const STAMP_ROTATION = (-7 * Math.PI) / 180;
const STAMP_WIDTH = 560;
/** Stamp ink: bright red, mostly normal blending so it reads on dark photos too. */
const STAMP_RED = '#e0261f';
const STAMP_INK_ALPHA = 0.88;
const STAMP_MULTIPLY_ALPHA = 0.25;
const STAMP_SHADOW_ALPHA = 0.35;

/** Draws the user's image into a CANVAS_SIZE square, center-cropped (cover) or letterboxed (contain). */
export function renderFittedSubject(source: CanvasImageSource & { width: number; height: number }, fit: FitMode): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CANVAS_SIZE;
  c.height = CANVAS_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const sw = source.width;
  const sh = source.height;
  ctx.imageSmoothingQuality = 'high';
  if (fit === 'cover') {
    const k = Math.max(CANVAS_SIZE / sw, CANVAS_SIZE / sh);
    const cw = CANVAS_SIZE / k;
    const ch = CANVAS_SIZE / k;
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else {
    ctx.fillStyle = CONTAIN_BG;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const k = Math.min(CANVAS_SIZE / sw, CANVAS_SIZE / sh);
    const dw = sw * k;
    const dh = sh * k;
    ctx.drawImage(source, (CANVAS_SIZE - dw) / 2, (CANVAS_SIZE - dh) / 2, dw, dh);
  }
  return c;
}

export function drawHat(ctx: CanvasRenderingContext2D, hat: LoadedHat, t: HatTransform): void {
  const { w, h } = hatSize(t, hat.aspect);
  const b = hat.bounds;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.rotation);
  if (t.flip) ctx.scale(-1, 1);
  // a soft contact shadow so the hat sits on the head instead of floating
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hat.img, b.sx, b.sy, b.w, b.h, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawLaserEye(ctx: CanvasRenderingContext2D, p: Vec, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // wide red glow
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
  glow.addColorStop(0, 'rgba(255,70,50,0.95)');
  glow.addColorStop(0.25, 'rgba(255,10,10,0.55)');
  glow.addColorStop(0.6, 'rgba(200,0,0,0.18)');
  glow.addColorStop(1, 'rgba(160,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // horizontal lens streaks: a radial gradient squashed vertically
  const streak = (len: number, squash: number, core: string, mid: string) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, squash);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
    g.addColorStop(0, core);
    g.addColorStop(0.18, mid);
    g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  streak(r * 6, 0.07, 'rgba(255,230,220,0.95)', 'rgba(255,40,30,0.6)');
  streak(r * 9, 0.022, 'rgba(255,255,255,0.9)', 'rgba(255,80,60,0.45)');

  // white-hot core
  const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 0.6);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.45, 'rgba(255,240,230,0.95)');
  core.addColorStop(1, 'rgba(255,60,40,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D): void {
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 4;
  const tctx = tile.getContext('2d');
  if (!tctx) return;
  tctx.fillStyle = 'rgba(0,0,0,0.32)';
  tctx.fillRect(0, 2, 1, 2);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  // faint phosphor tint
  ctx.fillStyle = 'rgba(61,255,122,0.05)';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  const vignette = ctx.createRadialGradient(500, 500, 380, 500, 500, 740);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.restore();
}

/** Small deterministic PRNG so the worn-ink texture is identical on every redraw. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Renders the CLASSIFIED stamp once into its own canvas. Call after the
 * Special Elite font has loaded (document.fonts.load) or it falls back to Courier.
 */
export function createStampCanvas(): HTMLCanvasElement {
  const W = 640;
  const H = 210;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const red = STAMP_RED;
  ctx.strokeStyle = red;
  ctx.fillStyle = red;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.font = '112px "Special Elite", "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'CLASSIFIED';
  const measured = ctx.measureText(text).width;
  const maxText = W - 90;
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  if (measured > maxText) ctx.scale(maxText / measured, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();

  // worn ink: knock out speckles and a few dry streaks
  const rand = mulberry32(0x7f01);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    const r = rand() < 0.9 ? rand() * 2.2 + 0.4 : rand() * 6 + 2;
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.35;
    ctx.lineWidth = 2 + rand() * 5;
    const y = rand() * H;
    ctx.beginPath();
    ctx.moveTo(rand() * W * 0.3, y);
    ctx.lineTo(W * 0.5 + rand() * W * 0.5, y + (rand() - 0.5) * 30);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

function drawStamp(ctx: CanvasRenderingContext2D, stamp: HTMLCanvasElement): void {
  const k = STAMP_WIDTH / stamp.width;
  const w = stamp.width * k;
  const h = stamp.height * k;
  ctx.save();
  ctx.translate(STAMP_CENTER.x, STAMP_CENTER.y);
  ctx.rotate(STAMP_ROTATION);
  // 1. faint dark edge under the ink so it separates from busy photos
  ctx.shadowColor = `rgba(0,0,0,${STAMP_SHADOW_ALPHA})`;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = STAMP_INK_ALPHA;
  ctx.globalCompositeOperation = 'source-over';
  // 2. main ink pass, normal blending: legible on dark and light images alike
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
  // 3. subtle multiply on top for ink depth on light images (no effect on dark pixels)
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = STAMP_MULTIPLY_ALPHA;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Draws the exportable scene onto a CANVAS_SIZE square context. */
export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState, stamp: HTMLCanvasElement | null): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (s.subject) {
    ctx.drawImage(s.subject, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else {
    ctx.fillStyle = EMPTY_BG;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  if (s.hat) drawHat(ctx, s.hat, s.transform);
  if (s.overlays.laser) {
    drawLaserEye(ctx, s.eyes.left, s.eyes.size);
    drawLaserEye(ctx, s.eyes.right, s.eyes.size);
  }
  if (s.overlays.stamp && stamp) drawStamp(ctx, stamp);
  if (s.overlays.scanlines) drawScanlines(ctx);
  ctx.restore();
}

const GUIDE = '#3dff7a';
const GUIDE_INK = '#080b08';
const HANDLE_RADIUS_CSS = 9;

/** Visible-canvas-only extras: circle crop guide, hat box, handles, eye targets. */
export function drawGuides(ctx: CanvasRenderingContext2D, s: SceneState, o: GuideOptions): void {
  const px = o.cssScale; // canvas px per CSS px
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (o.circleGuide) {
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - px, 0, Math.PI * 2);
    ctx.setLineDash([6 * px, 6 * px]);
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = 'rgba(61,255,122,0.7)';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (o.showHandles && s.hat) {
    const t = s.transform;
    const { w, h } = hatSize(t, s.hat.aspect);
    // hat box
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);
    ctx.setLineDash([8 * px, 6 * px]);
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = 'rgba(61,255,122,0.75)';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);
    // brim marker
    ctx.lineWidth = 2.5 * px;
    ctx.strokeStyle = 'rgba(255,176,0,0.9)';
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.stroke();
    // stalk to the rotate handle
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = 'rgba(61,255,122,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(0, h / 2 + ROTATE_HANDLE_OFFSET_CSS * px - HANDLE_RADIUS_CSS * px);
    ctx.stroke();
    ctx.restore();

    for (const hnd of handlePositions(t, s.hat.aspect, px)) {
      const active = o.active === hnd.id;
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = GUIDE;
      ctx.fillStyle = active ? GUIDE : GUIDE_INK;
      if (hnd.id === 'rotate') {
        ctx.beginPath();
        ctx.arc(hnd.pos.x, hnd.pos.y, HANDLE_RADIUS_CSS * px * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // little circular arrow glyph
        ctx.strokeStyle = active ? GUIDE_INK : GUIDE;
        ctx.lineWidth = 1.6 * px;
        ctx.beginPath();
        ctx.arc(hnd.pos.x, hnd.pos.y, HANDLE_RADIUS_CSS * px * 0.55, -Math.PI * 0.9, Math.PI * 0.55);
        ctx.stroke();
      } else {
        const r = HANDLE_RADIUS_CSS * px * 0.85;
        ctx.save();
        ctx.translate(hnd.pos.x, hnd.pos.y);
        ctx.rotate(t.rotation);
        ctx.fillRect(-r, -r, 2 * r, 2 * r);
        ctx.strokeRect(-r, -r, 2 * r, 2 * r);
        ctx.restore();
      }
    }
    // keep the brim marker readable even when the box is off-canvas: dot at brim center
    const b = brimCenter(t, s.hat.aspect);
    ctx.fillStyle = 'rgba(255,176,0,0.95)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3 * px, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.showHandles && s.overlays.laser) {
    for (const key of ['left', 'right'] as const) {
      const p = s.eyes[key];
      const active = o.active === (key === 'left' ? 'eye-left' : 'eye-right');
      const r = Math.max(s.eyes.size * 0.9, 14 * px);
      ctx.setLineDash([4 * px, 4 * px]);
      ctx.lineWidth = (active ? 2.5 : 1.5) * px;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

/** Round PFP preview drawn from the composed scene canvas. */
export function drawCirclePreview(ctx: CanvasRenderingContext2D, scene: HTMLCanvasElement): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scene, 0, 0, W, H);
  ctx.restore();
}
