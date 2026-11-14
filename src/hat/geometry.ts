/**
 * Pure placement math for the hat generator. No DOM, no React, so it can be
 * unit tested in Node (see geometry.test.ts).
 *
 * Coordinate system: the working canvas is CANVAS_SIZE x CANVAS_SIZE "canvas
 * px", origin top-left, y down. Rotation is in radians, positive = clockwise
 * on screen (the canvas convention).
 */

export const CANVAS_SIZE = 1000;

/** Owner's spec: hat about 60% of the canvas width. */
export const DEFAULT_HAT_SCALE = 0.6;
/** Owner's spec: brim (bottom edge of the hat) on the forehead line, in the top third. Fraction of canvas height. */
export const DEFAULT_BRIM_Y = 0.36;

/** Hat width as a fraction of canvas width. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2.5;

/** At least this many canvas px of the hat stay on the canvas, so it can never be lost. */
export const MIN_VISIBLE_PX = 80;

/** Distance (CSS px) from the brim center to the rotate handle, below the brim. */
export const ROTATE_HANDLE_OFFSET_CSS = 40;

/** Handle hit radius in CSS px. Touch gets a bigger target. */
export const HANDLE_HIT_RADIUS_TOUCH_CSS = 24;
export const HANDLE_HIT_RADIUS_MOUSE_CSS = 14;

/** Face auto-placement tuning (see placementFromFace). */
export const FACE_HAT_WIDTH_RATIO = 1.5;
export const FACE_BRIM_ABOVE_EYES_RATIO = 0.75;

export interface Vec {
  x: number;
  y: number;
}

export interface HatTransform {
  /** Hat center, canvas px. */
  x: number;
  y: number;
  /** Hat width as a fraction of canvas width. */
  scale: number;
  /** Radians, clockwise. */
  rotation: number;
  /** Mirror horizontally. */
  flip: boolean;
}

export type HandleId = 'scale-tl' | 'scale-tr' | 'scale-br' | 'scale-bl' | 'rotate';

export interface Handle {
  id: HandleId;
  pos: Vec;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const clampScale = (s: number): number => clamp(Number.isFinite(s) ? s : DEFAULT_HAT_SCALE, MIN_SCALE, MAX_SCALE);

/** Wraps an angle into (-PI, PI]. */
export function normalizeAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export function rotateVec(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Hat box size in canvas px. `aspect` = trimmed width / trimmed height. */
export function hatSize(t: Pick<HatTransform, 'scale'>, aspect: number): { w: number; h: number } {
  const w = t.scale * CANVAS_SIZE;
  return { w, h: w / aspect };
}

/** Owner's default: centered, 60% wide, brim at 36% of the height. The tip may poke off the top; accepted. */
export function defaultPlacement(aspect: number): HatTransform {
  const scale = DEFAULT_HAT_SCALE;
  const { h } = hatSize({ scale }, aspect);
  return {
    x: CANVAS_SIZE / 2,
    y: DEFAULT_BRIM_Y * CANVAS_SIZE - h / 2,
    scale,
    rotation: 0,
    flip: false,
  };
}

/** World point -> hat-local point (origin at hat center, axes aligned with the unrotated hat). */
export function toLocal(p: Vec, t: HatTransform): Vec {
  return rotateVec({ x: p.x - t.x, y: p.y - t.y }, -t.rotation);
}

/** Hat-local point -> world point. */
export function toWorld(local: Vec, t: HatTransform): Vec {
  const r = rotateVec(local, t.rotation);
  return { x: r.x + t.x, y: r.y + t.y };
}

/** Center of the brim (bottom edge of the hat box) in world coords. Flip does not move it. */
export function brimCenter(t: HatTransform, aspect: number): Vec {
  return toWorld({ x: 0, y: hatSize(t, aspect).h / 2 }, t);
}

/** True when `p` is inside the rotated hat box, grown by `pad` canvas px. Flip is irrelevant (the box is symmetric). */
export function pointInHat(p: Vec, t: HatTransform, aspect: number, pad = 0): boolean {
  const { w, h } = hatSize(t, aspect);
  const l = toLocal(p, t);
  return Math.abs(l.x) <= w / 2 + pad && Math.abs(l.y) <= h / 2 + pad;
}

/**
 * Handle positions in world coords. `cssScale` = canvas px per CSS px, so the
 * rotate handle sits a constant on-screen distance below the brim no matter
 * how small the canvas is displayed.
 */
export function handlePositions(t: HatTransform, aspect: number, cssScale: number): Handle[] {
  const { w, h } = hatSize(t, aspect);
  const hw = w / 2;
  const hh = h / 2;
  return [
    { id: 'scale-tl', pos: toWorld({ x: -hw, y: -hh }, t) },
    { id: 'scale-tr', pos: toWorld({ x: hw, y: -hh }, t) },
    { id: 'scale-br', pos: toWorld({ x: hw, y: hh }, t) },
    { id: 'scale-bl', pos: toWorld({ x: -hw, y: hh }, t) },
    { id: 'rotate', pos: toWorld({ x: 0, y: hh + ROTATE_HANDLE_OFFSET_CSS * cssScale }, t) },
  ];
}

/** Nearest handle within `radius` canvas px of `p`, or null. The rotate handle wins ties. */
export function hitHandle(p: Vec, t: HatTransform, aspect: number, cssScale: number, radius: number): HandleId | null {
  let best: HandleId | null = null;
  let bestD = Infinity;
  for (const hnd of handlePositions(t, aspect, cssScale)) {
    const d = dist(p, hnd.pos);
    if (d <= radius && (d < bestD || (d === bestD && hnd.id === 'rotate'))) {
      best = hnd.id;
      bestD = d;
    }
  }
  return best;
}

/**
 * Keeps the hat findable: scale within range, rotation normalized, and the
 * center kept close enough to the canvas that at least MIN_VISIBLE_PX of the
 * hat's smaller half-extent overlaps it.
 */
export function clampTransform(t: HatTransform, aspect: number): HatTransform {
  const scale = clampScale(t.scale);
  const { w, h } = hatSize({ scale }, aspect);
  const reach = Math.max(0, Math.min(w, h) / 2 - MIN_VISIBLE_PX);
  return {
    x: clamp(Number.isFinite(t.x) ? t.x : CANVAS_SIZE / 2, -reach, CANVAS_SIZE + reach),
    y: clamp(Number.isFinite(t.y) ? t.y : CANVAS_SIZE / 2, -reach, CANVAS_SIZE + reach),
    scale,
    rotation: normalizeAngle(Number.isFinite(t.rotation) ? t.rotation : 0),
    flip: t.flip,
  };
}

/** Drag a corner handle: scale about the hat center by the change in distance from the center. */
export function scaleFromHandleDrag(start: HatTransform, startPt: Vec, pt: Vec): HatTransform {
  const c = { x: start.x, y: start.y };
  const d0 = Math.max(1, dist(startPt, c));
  return { ...start, scale: clampScale(start.scale * (dist(pt, c) / d0)) };
}

/** Drag the rotate handle: rotate by the change in angle around the hat center. */
export function rotateFromHandleDrag(start: HatTransform, startPt: Vec, pt: Vec): HatTransform {
  const a0 = Math.atan2(startPt.y - start.y, startPt.x - start.x);
  const a1 = Math.atan2(pt.y - start.y, pt.x - start.x);
  return { ...start, rotation: normalizeAngle(start.rotation + (a1 - a0)) };
}

/** Plain drag: translate by the pointer delta. */
export function moveFromDrag(start: HatTransform, startPt: Vec, pt: Vec): HatTransform {
  return { ...start, x: start.x + (pt.x - startPt.x), y: start.y + (pt.y - startPt.y) };
}

/**
 * Two-finger gesture: scale by the change in finger distance, rotate by the
 * change in finger angle, translate with the midpoint. The transform is applied
 * about the starting midpoint so the hat stays "glued" under the fingers.
 */
export function pinchTransform(start: HatTransform, a0: Vec, b0: Vec, a1: Vec, b1: Vec): HatTransform {
  const d0 = Math.max(1, dist(a0, b0));
  const d1 = Math.max(1, dist(a1, b1));
  const ang0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const ang1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
  const dAng = ang1 - ang0;
  const newScale = clampScale(start.scale * (d1 / d0));
  const k = newScale / start.scale; // effective factor after clamping
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const off = rotateVec({ x: (start.x - m0.x) * k, y: (start.y - m0.y) * k }, dAng);
  return {
    ...start,
    x: m1.x + off.x,
    y: m1.y + off.y,
    scale: newScale,
    rotation: normalizeAngle(start.rotation + dAng),
  };
}

/** Scale about the hat center by a factor (wheel, keyboard, slider). */
export function scaleBy(t: HatTransform, factor: number): HatTransform {
  return { ...t, scale: clampScale(t.scale * factor) };
}

/**
 * Switching to a hat with a different aspect ratio: keep scale, rotation and
 * the brim center fixed, so the new hat sits on the same forehead line.
 */
export function rebaseForAspect(t: HatTransform, oldAspect: number, newAspect: number): HatTransform {
  const brim = brimCenter(t, oldAspect);
  const hNew = hatSize(t, newAspect).h;
  const back = rotateVec({ x: 0, y: -hNew / 2 }, t.rotation);
  return { ...t, x: brim.x + back.x, y: brim.y + back.y };
}

export interface FaceGeometry {
  /** The two eye centers, any order, canvas px. */
  eyes: [Vec, Vec];
  /** Face box width, canvas px. */
  faceWidth: number;
  /** Optional: used to decide which side of the eye line is "up". */
  mouth?: Vec;
  nose?: Vec;
}

/**
 * Hat placement for a detected face: hat width FACE_HAT_WIDTH_RATIO x the face
 * box, rotated to the eye line, brim centered on the forehead
 * FACE_BRIM_ABOVE_EYES_RATIO x the inter-eye distance above the eye midpoint,
 * along the head's up direction. Keeps the current flip.
 */
export function placementFromFace(face: FaceGeometry, aspect: number, flip = false): HatTransform {
  const [p, q] = face.eyes[0].x <= face.eyes[1].x ? face.eyes : [face.eyes[1], face.eyes[0]];
  const ex = q.x - p.x;
  const ey = q.y - p.y;
  const interEye = Math.max(1, Math.hypot(ex, ey));
  let angle = Math.atan2(ey, ex);
  // Perpendicular to the eye line; for a level face (ex>0, ey=0) this is (0,-1), i.e. screen up.
  let up = { x: ey / interEye, y: -ex / interEye };
  const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const below = face.mouth ?? face.nose;
  if (below && (below.x - mid.x) * up.x + (below.y - mid.y) * up.y > 0) {
    // Mouth is on the "up" side: the head is upside down.
    up = { x: -up.x, y: -up.y };
    angle += Math.PI;
  }
  const scale = clampScale((FACE_HAT_WIDTH_RATIO * face.faceWidth) / CANVAS_SIZE);
  const { h } = hatSize({ scale }, aspect);
  const lift = FACE_BRIM_ABOVE_EYES_RATIO * interEye;
  const brim = { x: mid.x + up.x * lift, y: mid.y + up.y * lift };
  return {
    x: brim.x + up.x * (h / 2),
    y: brim.y + up.y * (h / 2),
    scale,
    rotation: normalizeAngle(angle),
    flip,
  };
}

/** Pointer position in canvas px from client coords and the canvas's bounding rect. */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Vec {
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_SIZE,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_SIZE,
  };
}

export const radToDeg = (r: number): number => (r * 180) / Math.PI;
export const degToRad = (d: number): number => (d * Math.PI) / 180;

export interface HitCandidate<T> {
  id: T;
  pos: Vec;
  /** Hit radius for this target, canvas px. */
  radius: number;
}

/**
 * Picks the target whose center is closest to `pt` among those within their
 * own hit radius, or null (the caller then moves the hat). Ties go to the
 * earlier candidate.
 */
export function pickNearestTarget<T>(pt: Vec, candidates: HitCandidate<T>[]): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = dist(pt, c.pos);
    if (d <= c.radius && d < bestD) {
      best = c.id;
      bestD = d;
    }
  }
  return best;
}
