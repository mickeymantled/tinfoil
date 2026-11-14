import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_SIZE,
  DEFAULT_BRIM_Y,
  DEFAULT_HAT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  brimCenter,
  clampTransform,
  clientToCanvas,
  defaultPlacement,
  handlePositions,
  hatSize,
  hitHandle,
  moveFromDrag,
  normalizeAngle,
  pickNearestTarget,
  pinchTransform,
  placementFromFace,
  pointInHat,
  rebaseForAspect,
  rotateFromHandleDrag,
  scaleFromHandleDrag,
  toLocal,
  toWorld,
  type HatTransform,
  type Vec,
} from './geometry';

const ASPECT = 643 / 540;
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const nearVec = (a: Vec, b: Vec, eps = 1e-6) => {
  near(a.x, b.x, eps);
  near(a.y, b.y, eps);
};
const base = (over: Partial<HatTransform> = {}): HatTransform => ({ x: 500, y: 300, scale: 0.5, rotation: 0, flip: false, ...over });

test('default placement: centered, 60% wide, brim at 36%', () => {
  const t = defaultPlacement(ASPECT);
  near(t.x, CANVAS_SIZE / 2);
  near(t.scale, DEFAULT_HAT_SCALE);
  const { w, h } = hatSize(t, ASPECT);
  near(w, 600);
  near(h, 600 / ASPECT);
  near(brimCenter(t, ASPECT).y, DEFAULT_BRIM_Y * CANVAS_SIZE);
  // The tip pokes above the canvas with this hat (accepted by the spec).
  assert.ok(t.y - h / 2 < 0);
  near(t.rotation, 0);
  assert.equal(t.flip, false);
});

test('toLocal / toWorld round trip under rotation', () => {
  const t = base({ rotation: 0.7 });
  const p = { x: 123, y: 456 };
  nearVec(toWorld(toLocal(p, t), t), p);
});

test('pointInHat respects rotation and ignores flip', () => {
  const t = base({ rotation: Math.PI / 2 });
  const { w, h } = hatSize(t, ASPECT);
  // Rotated 90deg: the box's width now runs vertically.
  assert.ok(pointInHat({ x: 500, y: 300 + w / 2 - 1 }, t, ASPECT));
  assert.ok(!pointInHat({ x: 500 + h / 2 + 5, y: 300 }, t, ASPECT));
  assert.ok(pointInHat({ x: 500 + h / 2 - 1, y: 300 }, t, ASPECT));
  assert.ok(pointInHat({ x: 500, y: 300 + w / 2 - 1 }, { ...t, flip: true }, ASPECT));
  assert.ok(!pointInHat({ x: 500, y: 300 + w / 2 + 5 }, t, ASPECT));
  assert.ok(pointInHat({ x: 500, y: 300 + w / 2 + 5 }, t, ASPECT, 10));
});

test('handles: corners on the box, rotate handle below the brim at constant CSS distance', () => {
  const t = base();
  const { w, h } = hatSize(t, ASPECT);
  const hs = handlePositions(t, ASPECT, 2);
  nearVec(hs.find((x) => x.id === 'scale-br')!.pos, { x: 500 + w / 2, y: 300 + h / 2 });
  const rot = hs.find((x) => x.id === 'rotate')!.pos;
  near(rot.x, 500);
  near(rot.y, 300 + h / 2 + 40 * 2);
  // Rotated 180deg the rotate handle goes above the center.
  const r = handlePositions(base({ rotation: Math.PI }), ASPECT, 1).find((x) => x.id === 'rotate')!.pos;
  assert.ok(r.y < 300);
});

test('hitHandle finds handles within radius only', () => {
  const t = base({ rotation: 0.3 });
  const hs = handlePositions(t, ASPECT, 1.5);
  const rot = hs.find((x) => x.id === 'rotate')!.pos;
  assert.equal(hitHandle({ x: rot.x + 10, y: rot.y }, t, ASPECT, 1.5, 30), 'rotate');
  assert.equal(hitHandle({ x: rot.x + 40, y: rot.y }, t, ASPECT, 1.5, 30), null);
  const bl = hs.find((x) => x.id === 'scale-bl')!.pos;
  assert.equal(hitHandle(bl, t, ASPECT, 1.5, 30), 'scale-bl');
});

test('corner drag scales about the center, clamped', () => {
  const t = base();
  const start = { x: 700, y: 300 };
  near(scaleFromHandleDrag(t, start, { x: 900, y: 300 }).scale, 1.0);
  near(scaleFromHandleDrag(t, start, { x: 500.5, y: 300 }).scale, MIN_SCALE);
  near(scaleFromHandleDrag(t, start, { x: 500 + 200 * 100, y: 300 }).scale, MAX_SCALE);
});

test('rotate handle drag rotates by the swept angle', () => {
  const t = base();
  // Handle below center, drag to the left of center: +90deg (clockwise on screen).
  const r = rotateFromHandleDrag(t, { x: 500, y: 500 }, { x: 300, y: 300 });
  near(r.rotation, Math.PI / 2);
});

test('move drag translates', () => {
  const r = moveFromDrag(base(), { x: 10, y: 10 }, { x: 25, y: -5 });
  near(r.x, 515);
  near(r.y, 285);
});

test('pinch: spread doubles scale, twist rotates, hat stays glued to the midpoint', () => {
  const t = base({ x: 500, y: 300 });
  const a0 = { x: 400, y: 300 };
  const b0 = { x: 600, y: 300 };
  // Pure spread around the same midpoint.
  const s = pinchTransform(t, a0, b0, { x: 300, y: 300 }, { x: 700, y: 300 });
  near(s.scale, 1.0);
  near(s.x, 500);
  near(s.y, 300);
  // Pure twist 90deg around the midpoint.
  const r = pinchTransform(t, a0, b0, { x: 500, y: 200 }, { x: 500, y: 400 });
  near(r.rotation, Math.PI / 2);
  near(r.scale, 0.5);
  // Translate both fingers.
  const m = pinchTransform(t, a0, b0, { x: 450, y: 350 }, { x: 650, y: 350 });
  near(m.x, 550);
  near(m.y, 350);
  // Off-center hat rotates around the finger midpoint.
  const o = pinchTransform(base({ x: 600, y: 300 }), a0, b0, { x: 500, y: 200 }, { x: 500, y: 400 });
  near(o.x, 500);
  near(o.y, 400);
});

test('pinch respects scale clamp without drifting the anchor', () => {
  const t = base({ scale: MAX_SCALE });
  const r = pinchTransform(t, { x: 400, y: 300 }, { x: 600, y: 300 }, { x: 300, y: 300 }, { x: 700, y: 300 });
  near(r.scale, MAX_SCALE);
  near(r.x, 500);
});

test('clampTransform keeps the hat reachable and normalizes', () => {
  const t = clampTransform(base({ x: -5000, y: 99999, scale: 99, rotation: 3 * Math.PI }), ASPECT);
  near(t.scale, MAX_SCALE);
  const { w, h } = hatSize(t, ASPECT);
  const reach = Math.min(w, h) / 2 - 80;
  near(t.x, -reach);
  near(t.y, CANVAS_SIZE + reach);
  near(t.rotation, Math.PI);
  const n = clampTransform(base({ x: NaN, scale: NaN }), ASPECT);
  near(n.x, 500);
  near(n.scale, DEFAULT_HAT_SCALE);
});

test('normalizeAngle', () => {
  near(normalizeAngle(2 * Math.PI), 0);
  near(normalizeAngle(-Math.PI), Math.PI);
  near(normalizeAngle(1.5 * Math.PI), -0.5 * Math.PI);
});

test('rebaseForAspect keeps the brim fixed', () => {
  const t = base({ rotation: 0.4 });
  const before = brimCenter(t, ASPECT);
  const r = rebaseForAspect(t, ASPECT, 2);
  nearVec(brimCenter(r, 2), before);
});

test('placementFromFace: level face', () => {
  const eyes: [Vec, Vec] = [
    { x: 560, y: 500 },
    { x: 440, y: 500 },
  ];
  const t = placementFromFace({ eyes, faceWidth: 300, mouth: { x: 500, y: 620 } }, ASPECT);
  near(t.scale, 0.45);
  near(t.rotation, 0);
  const brim = brimCenter(t, ASPECT);
  near(brim.x, 500);
  near(brim.y, 500 - 0.75 * 120);
});

test('placementFromFace: tilted face follows the eye line, brim lifted along head-up', () => {
  const a = 0.3;
  const mid = { x: 500, y: 500 };
  const half = { x: Math.cos(a) * 60, y: Math.sin(a) * 60 };
  const eyes: [Vec, Vec] = [
    { x: mid.x - half.x, y: mid.y - half.y },
    { x: mid.x + half.x, y: mid.y + half.y },
  ];
  const mouth = { x: mid.x - Math.sin(a) * 120, y: mid.y + Math.cos(a) * 120 };
  const t = placementFromFace({ eyes, faceWidth: 300, mouth }, ASPECT, true);
  near(t.rotation, a);
  assert.equal(t.flip, true);
  const brim = brimCenter(t, ASPECT);
  nearVec(brim, { x: mid.x + Math.sin(a) * 90, y: mid.y - Math.cos(a) * 90 });
});

test('placementFromFace: upside-down face flips the hat', () => {
  const eyes: [Vec, Vec] = [
    { x: 440, y: 500 },
    { x: 560, y: 500 },
  ];
  const t = placementFromFace({ eyes, faceWidth: 300, mouth: { x: 500, y: 380 } }, ASPECT);
  near(Math.abs(t.rotation), Math.PI);
  assert.ok(brimCenter(t, ASPECT).y > 500);
});

test('clientToCanvas maps a CSS-scaled canvas to 1000px space', () => {
  const rect = { left: 20, top: 100, width: 320, height: 320 };
  nearVec(clientToCanvas(20, 100, rect), { x: 0, y: 0 });
  nearVec(clientToCanvas(180, 260, rect), { x: 500, y: 500 });
  nearVec(clientToCanvas(340, 420, rect), { x: 1000, y: 1000 });
});

test('pickNearestTarget: closest candidate within its own radius wins', () => {
  const t = base();
  const rot = handlePositions(t, ASPECT, 3).find((x) => x.id === 'rotate')!.pos;
  const eye = { x: rot.x + 80, y: rot.y };
  const cands = [
    ...handlePositions(t, ASPECT, 3).map((h) => ({ id: h.id as string, pos: h.pos, radius: 73 })),
    { id: 'eye-left', pos: eye, radius: 73 },
  ];
  // exactly on the rotate handle, eye 80px away (eye radius would cover it before): handle wins
  assert.equal(pickNearestTarget({ x: rot.x + 0, y: rot.y }, cands), 'rotate');
  // a bit toward the eye but still nearer the handle
  assert.equal(pickNearestTarget({ x: rot.x + 30, y: rot.y }, cands), 'rotate');
  // on the eye: eye wins
  assert.equal(pickNearestTarget(eye, cands), 'eye-left');
  // between them, nearer the eye: eye wins
  assert.equal(pickNearestTarget({ x: rot.x + 50, y: rot.y }, cands), 'eye-left');
  // nothing in range: null (caller moves the hat)
  assert.equal(pickNearestTarget({ x: rot.x, y: rot.y + 500 }, cands), null);
});
