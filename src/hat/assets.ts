/**
 * Loading hats and the user's image. Browser-only, no React.
 */
import type { HatAsset } from 'virtual:hats';

/** Opaque bounding box of a hat image, in source image px. */
export interface HatBounds {
  sx: number;
  sy: number;
  w: number;
  h: number;
}

export interface LoadedHat {
  asset: HatAsset;
  img: HTMLImageElement;
  bounds: HatBounds;
  /** bounds.w / bounds.h */
  aspect: number;
}

/** Alpha above this counts as "hat" when trimming transparent padding. */
const ALPHA_THRESHOLD = 8;

/** Longest side we keep of the user's image (it is drawn into a 1000px square anyway). */
const MAX_SOURCE_SIDE = 2048;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|svg)$/i;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Scans the alpha channel once and returns the tight opaque box (full image if fully transparent or unreadable). */
export function computeOpaqueBounds(img: HTMLImageElement): HatBounds {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const full = { sx: 0, sy: 0, w: W, h: H };
  try {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return full;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    let minX = W;
    let minY = H;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < H; y++) {
      const row = y * W * 4;
      for (let x = 0; x < W; x++) {
        if (data[row + x * 4 + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return full;
    return { sx: minX, sy: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch {
    return full;
  }
}

/** Loads every listed hat. Hats that fail to load are dropped; the caller shows an error if none survive. */
export async function loadHats(list: HatAsset[]): Promise<LoadedHat[]> {
  const results = await Promise.allSettled(
    list.map(async (asset) => {
      const img = await loadImage(asset.url);
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image');
      const bounds = computeOpaqueBounds(img);
      return { asset, img, bounds, aspect: bounds.w / bounds.h } satisfies LoadedHat;
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

export class ImageInputError extends Error {}

/** Throws ImageInputError with a friendly message when the file is not something we can use. */
export function validateImageFile(file: Blob & { name?: string }): void {
  const type = file.type || '';
  const looksLikeImage = type.startsWith('image/') || (!type && !!file.name && IMAGE_EXT.test(file.name));
  if (!looksLikeImage) {
    throw new ImageInputError('That is not an image. Use a JPG, PNG, WEBP or GIF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageInputError('That image is over 25 MB. Try a smaller one (a screenshot works).');
  }
}

/**
 * Decodes the user's image into a canvas (capped at MAX_SOURCE_SIDE), entirely
 * in the browser. The temporary object URL is always revoked.
 */
export async function decodeUserImage(file: Blob & { name?: string }): Promise<HTMLCanvasElement> {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
      if (img.decode) await img.decode().catch(() => undefined);
    } catch {
      const heic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name ?? '');
      throw new ImageInputError(
        heic
          ? 'This browser cannot open HEIC photos. Take a screenshot of it, or export it as JPG, and try again.'
          : 'Could not read that image. It may be damaged or in a format this browser does not support. Try a JPG or PNG.',
      );
    }
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (!W || !H) throw new ImageInputError('That image appears to be empty. Try another one.');
    const k = Math.min(1, MAX_SOURCE_SIDE / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    const ctx = c.getContext('2d');
    if (!ctx) throw new ImageInputError('Your browser could not create a drawing surface.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A plain head-and-shoulders silhouette on a dark gradient, so people can play before uploading. */
export function makeTestSubject(size = 1000): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const s = size / 1000;
  ctx.scale(s, s);

  const bg = ctx.createRadialGradient(500, 420, 60, 500, 500, 760);
  bg.addColorStop(0, '#1f3a2a');
  bg.addColorStop(0.55, '#0e1a12');
  bg.addColorStop(1, '#040604');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1000, 1000);

  // faint grid, interrogation-room vibe
  ctx.strokeStyle = 'rgba(61,255,122,0.06)';
  ctx.lineWidth = 2;
  for (let i = 50; i < 1000; i += 100) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1000);
    ctx.moveTo(0, i);
    ctx.lineTo(1000, i);
    ctx.stroke();
  }

  const body = ctx.createLinearGradient(0, 260, 0, 1000);
  body.addColorStop(0, '#5b6b60');
  body.addColorStop(1, '#2a332d');
  ctx.fillStyle = body;

  // shoulders and neck
  ctx.beginPath();
  ctx.moveTo(110, 1000);
  ctx.bezierCurveTo(120, 830, 250, 770, 400, 750);
  ctx.lineTo(430, 690);
  ctx.lineTo(570, 690);
  ctx.lineTo(600, 750);
  ctx.bezierCurveTo(750, 770, 880, 830, 890, 1000);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.ellipse(500, 500, 185, 230, 0, 0, Math.PI * 2);
  ctx.fill();

  // rim light
  ctx.strokeStyle = 'rgba(180,245,200,0.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(500, 500, 185, 230, 0, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  return c;
}

/** Eye positions that suit the test subject silhouette (canvas px). */
export const TEST_SUBJECT_EYES = {
  left: { x: 430, y: 495 },
  right: { x: 570, y: 495 },
};
