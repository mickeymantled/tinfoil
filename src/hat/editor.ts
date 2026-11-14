/**
 * HatEditor: the stateful core of the hat generator, framework free.
 *
 * It owns the editor state, the offscreen scene canvas (what gets exported),
 * the visible canvas's input listeners and a requestAnimationFrame draw loop.
 * React subscribes with useSyncExternalStore(editor.subscribe, editor.getSnapshot).
 *
 * Update rules:
 * - Pointer gestures mutate state and publish a new snapshot at most once per
 *   animation frame (cheap React renders during drags).
 * - UI calls (sliders, toggles) publish synchronously, so controlled inputs
 *   never snap back, and draw on the next frame.
 */
import type { LoadedHat } from './assets';
import type { DetectedFace } from './faceDetect';
import {
  CANVAS_SIZE,
  HANDLE_HIT_RADIUS_MOUSE_CSS,
  HANDLE_HIT_RADIUS_TOUCH_CSS,
  clampScale,
  clampTransform,
  clientToCanvas,
  defaultPlacement,
  degToRad,
  dist,
  handlePositions,
  hatSize,
  hitHandle,
  moveFromDrag,
  pickNearestTarget,
  pinchTransform,
  placementFromFace,
  pointInHat,
  rebaseForAspect,
  rotateFromHandleDrag,
  scaleBy,
  scaleFromHandleDrag,
  type HandleId,
  type HitCandidate,
  type HatTransform,
  type Vec,
} from './geometry';
import {
  createStampCanvas,
  drawCirclePreview,
  drawGuides,
  drawScene,
  renderFittedSubject,
  type ActiveTarget,
  type EyeState,
  type FitMode,
  type Overlays,
} from './render';

/** Used only until the real hat has loaded. Matches public/hats/tinfoil-hat.png (643x540). */
const FALLBACK_ASPECT = 643 / 540;

export const DEFAULT_EYES: Omit<EyeState, 'size'> = {
  left: { x: 420, y: 480 },
  right: { x: 580, y: 480 },
};
export const DEFAULT_EYE_SIZE = 55;
export const MIN_EYE_SIZE = 20;
export const MAX_EYE_SIZE = 150;

const NUDGE = 5;
const NUDGE_BIG = 25;
const KEY_SCALE = 1.03;
const KEY_ROT = degToRad(1);
const KEY_ROT_BIG = degToRad(5);

export type OverlayKey = keyof Overlays;

export interface EditorSnapshot {
  hasSubject: boolean;
  isTestSubject: boolean;
  fit: FitMode;
  hatCount: number;
  hatIndex: number;
  transform: HatTransform;
  overlays: Overlays;
  circleGuide: boolean;
  eyeSize: number;
  stampReady: boolean;
  /** True once the user has moved/scaled/rotated/reset the hat for this subject. */
  touched: boolean;
  /** Bumps on every change to the exported image. */
  version: number;
}

type Gesture =
  | { kind: 'move'; id: number; startPt: Vec; start: HatTransform }
  | { kind: 'handle'; handle: HandleId; id: number; startPt: Vec; start: HatTransform }
  | { kind: 'eye'; which: 'left' | 'right'; id: number; offset: Vec }
  | { kind: 'pinch'; ids: [number, number]; a0: Vec; b0: Vec; start: HatTransform };

interface PointerInfo {
  pt: Vec;
  type: string;
}

/** Safari's non-standard trackpad gesture event. */
interface SafariGestureEvent extends UIEvent {
  scale: number;
  rotation: number;
}

export class HatEditor {
  private hats: LoadedHat[] = [];
  private hatIndex = 0;
  private source: HTMLCanvasElement | null = null;
  private subject: HTMLCanvasElement | null = null;
  private isTestSubject = false;
  private fit: FitMode = 'cover';
  private transform: HatTransform = defaultPlacement(FALLBACK_ASPECT);
  private overlays: Overlays = { scanlines: false, stamp: false, laser: false };
  private circleGuide = false;
  private eyes: EyeState = { ...DEFAULT_EYES, size: DEFAULT_EYE_SIZE };
  private stamp: HTMLCanvasElement | null = null;
  private stampLoading = false;
  private touched = false;
  private eyesTouched = false;
  private version = 0;

  private readonly scene: HTMLCanvasElement;
  private canvas: HTMLCanvasElement | null = null;
  private preview: HTMLCanvasElement | null = null;

  private pointers = new Map<number, PointerInfo>();
  private gesture: Gesture | null = null;
  private gestureBase: { scale: number; rotation: number } | null = null; // Safari trackpad
  private raf = 0;
  private publishOnFrame = false;
  private listeners = new Set<() => void>();
  private snap: EditorSnapshot;
  private exportCache: { version: number; blob: Blob } | null = null;
  private destroyed = false;

  constructor() {
    this.scene = document.createElement('canvas');
    this.scene.width = CANVAS_SIZE;
    this.scene.height = CANVAS_SIZE;
    this.snap = this.buildSnapshot();
  }

  // ---- store API (useSyncExternalStore) ----

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): EditorSnapshot => this.snap;

  private buildSnapshot(): EditorSnapshot {
    return {
      hasSubject: !!this.subject,
      isTestSubject: this.isTestSubject,
      fit: this.fit,
      hatCount: this.hats.length,
      hatIndex: this.hatIndex,
      transform: { ...this.transform },
      overlays: { ...this.overlays },
      circleGuide: this.circleGuide,
      eyeSize: this.eyes.size,
      stampReady: !!this.stamp,
      touched: this.touched,
      version: this.version,
    };
  }

  private publish(): void {
    this.snap = this.buildSnapshot();
    for (const fn of this.listeners) fn();
  }

  /** Something changed. `sync` publishes now (UI), otherwise on the next frame (gestures). */
  private changed(opts: { scene?: boolean; sync?: boolean } = {}): void {
    if (opts.scene !== false) this.version++;
    if (opts.sync) this.publish();
    else this.publishOnFrame = true;
    this.requestDraw();
  }

  // ---- canvases ----

  /** Binds the visible canvas and its input listeners. Returns the cleanup. */
  attach(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const opts = { passive: false } as const;
    const down = (e: PointerEvent) => this.onPointerDown(e);
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const up = (e: PointerEvent) => this.onPointerEnd(e);
    const wheel = (e: WheelEvent) => this.onWheel(e);
    const key = (e: KeyboardEvent) => this.onKeyDown(e);
    const gStart = (e: Event) => this.onGesture(e as SafariGestureEvent, 'start');
    const gChange = (e: Event) => this.onGesture(e as SafariGestureEvent, 'change');
    const gEnd = (e: Event) => this.onGesture(e as SafariGestureEvent, 'end');
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('wheel', wheel, opts);
    canvas.addEventListener('keydown', key);
    canvas.addEventListener('gesturestart', gStart, opts);
    canvas.addEventListener('gesturechange', gChange, opts);
    canvas.addEventListener('gestureend', gEnd, opts);
    // Handle sizes depend on the displayed size, so redraw when it changes.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.requestDraw()) : null;
    ro?.observe(canvas);
    this.requestDraw();
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
      canvas.removeEventListener('gesturestart', gStart);
      canvas.removeEventListener('gesturechange', gChange);
      canvas.removeEventListener('gestureend', gEnd);
      ro?.disconnect();
      this.pointers.clear();
      this.gesture = null;
      if (this.canvas === canvas) this.canvas = null;
    };
  }

  setPreview(canvas: HTMLCanvasElement | null): void {
    this.preview = canvas;
    this.requestDraw();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.listeners.clear();
    this.canvas = null;
    this.preview = null;
  }

  private requestDraw(): void {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.drawNow();
      if (this.publishOnFrame) {
        this.publishOnFrame = false;
        this.publish();
      }
    });
  }

  private cssScale(): number {
    const w = this.canvas?.getBoundingClientRect().width ?? 0;
    return w > 0 ? CANVAS_SIZE / w : 1;
  }

  private sceneState() {
    return {
      subject: this.subject,
      hat: this.hats[this.hatIndex] ?? null,
      transform: this.transform,
      overlays: this.overlays,
      eyes: this.eyes,
    };
  }

  private activeTarget(): ActiveTarget {
    const g = this.gesture;
    if (!g) return null;
    if (g.kind === 'handle') return g.handle;
    if (g.kind === 'eye') return g.which === 'left' ? 'eye-left' : 'eye-right';
    return g.kind;
  }

  private drawNow(): void {
    const sctx = this.scene.getContext('2d');
    if (!sctx) return;
    const state = this.sceneState();
    drawScene(sctx, state, this.stamp);
    const canvas = this.canvas;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(this.scene, 0, 0);
      drawGuides(ctx, state, {
        cssScale: this.cssScale(),
        circleGuide: this.circleGuide && !!this.subject,
        showHandles: !!this.subject,
        active: this.activeTarget(),
      });
    }
    const pctx = this.preview?.getContext('2d');
    if (pctx) drawCirclePreview(pctx, this.scene);
  }

  // ---- state setters (UI) ----

  private aspect(): number {
    return this.hats[this.hatIndex]?.aspect ?? FALLBACK_ASPECT;
  }

  private setTransform(t: HatTransform): void {
    this.transform = clampTransform(t, this.aspect());
  }

  setHats(hats: LoadedHat[]): void {
    const oldAspect = this.aspect();
    this.hats = hats;
    this.hatIndex = 0;
    if (this.touched) this.setTransform(rebaseForAspect(this.transform, oldAspect, this.aspect()));
    else this.setTransform({ ...defaultPlacement(this.aspect()), flip: this.transform.flip });
    this.changed({ sync: true });
  }

  selectHat(index: number): void {
    if (!this.hats[index] || index === this.hatIndex) return;
    const oldAspect = this.aspect();
    this.hatIndex = index;
    this.setTransform(rebaseForAspect(this.transform, oldAspect, this.aspect()));
    this.changed({ sync: true });
  }

  /** Sets the user's image (already decoded) or the test subject. Default placement appears immediately. */
  setSubject(source: HTMLCanvasElement | null, opts: { isTest?: boolean; eyes?: Omit<EyeState, 'size'> } = {}): void {
    this.source = source;
    this.isTestSubject = !!opts.isTest;
    this.subject = source ? renderFittedSubject(source, this.fit) : null;
    this.transform = defaultPlacement(this.aspect());
    this.touched = false;
    this.eyesTouched = false;
    const e = opts.eyes ?? DEFAULT_EYES;
    this.eyes = { left: { ...e.left }, right: { ...e.right }, size: this.eyes.size };
    this.gesture = null;
    this.changed({ sync: true });
  }

  setFit(fit: FitMode): void {
    if (fit === this.fit) return;
    this.fit = fit;
    if (this.source) this.subject = renderFittedSubject(this.source, fit);
    // The image moved under the hat. If the user has not placed anything yet, start from the defaults again
    // (the page re-runs face detection on the new framing).
    if (!this.touched) this.transform = { ...defaultPlacement(this.aspect()), flip: this.transform.flip };
    if (!this.eyesTouched && !this.isTestSubject) this.eyes = { ...this.eyes, left: { ...DEFAULT_EYES.left }, right: { ...DEFAULT_EYES.right } };
    this.changed({ sync: true });
  }

  /** The fitted subject (no hat), for face detection. */
  getSubjectCanvas(): HTMLCanvasElement | null {
    return this.subject;
  }

  setScale(scale: number): void {
    this.touched = true;
    this.setTransform({ ...this.transform, scale: clampScale(scale) });
    this.changed({ sync: true });
  }

  setRotation(rad: number): void {
    this.touched = true;
    this.setTransform({ ...this.transform, rotation: rad });
    this.changed({ sync: true });
  }

  toggleFlip(): void {
    this.setTransform({ ...this.transform, flip: !this.transform.flip });
    this.changed({ sync: true });
  }

  resetPlacement(): void {
    this.touched = true; // a reset is a deliberate choice; background detection must not override it
    this.setTransform(defaultPlacement(this.aspect()));
    this.changed({ sync: true });
  }

  setOverlay(key: OverlayKey, on: boolean): void {
    this.overlays = { ...this.overlays, [key]: on };
    if (key === 'stamp' && on) void this.ensureStamp();
    this.changed({ sync: true });
  }

  setCircleGuide(on: boolean): void {
    this.circleGuide = on;
    this.changed({ sync: true, scene: false });
  }

  setEyeSize(size: number): void {
    this.eyes = { ...this.eyes, size: Math.min(MAX_EYE_SIZE, Math.max(MIN_EYE_SIZE, size)) };
    this.changed({ sync: true });
  }

  /**
   * Applies a detected face: hat placement and laser-eye positions. With
   * `force` false (background run) it does nothing if the user already
   * touched the hat, and leaves eyes alone if they were dragged.
   */
  applyFace(face: DetectedFace, force: boolean): boolean {
    if (!this.subject) return false;
    if (!force && this.touched) return false;
    this.setTransform(placementFromFace(face, this.aspect(), this.transform.flip));
    if (force || !this.eyesTouched) {
      const [a, b] = face.eyes[0].x <= face.eyes[1].x ? face.eyes : [face.eyes[1], face.eyes[0]];
      this.eyes = { ...this.eyes, left: { ...a }, right: { ...b } };
      // Scale the flare to the face so it reads at any size.
      const ie = dist(a, b);
      if (ie > 0) this.eyes.size = Math.min(MAX_EYE_SIZE, Math.max(MIN_EYE_SIZE, ie * 0.42));
    }
    if (force) this.touched = true;
    this.changed({ sync: true });
    return true;
  }

  private async ensureStamp(): Promise<void> {
    if (this.stamp || this.stampLoading) return;
    this.stampLoading = true;
    try {
      if (document.fonts?.load) {
        await Promise.race([
          document.fonts.load('112px "Special Elite"', 'CLASSIFIED'),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      }
    } catch {
      // fall back to Courier, still looks like a stamp
    }
    this.stampLoading = false;
    if (this.destroyed) return;
    this.stamp = createStampCanvas();
    this.changed({ sync: true });
  }

  // ---- export ----

  /** PNG of the scene (no handles, no guides), exactly CANVAS_SIZE square. Cached until the scene changes. */
  exportBlob(): Promise<Blob> {
    if (this.exportCache && this.exportCache.version === this.version) {
      return Promise.resolve(this.exportCache.blob);
    }
    const version = this.version;
    const sctx = this.scene.getContext('2d');
    if (sctx) drawScene(sctx, this.sceneState(), this.stamp);
    return new Promise((resolve, reject) => {
      this.scene.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Export failed'));
          return;
        }
        this.exportCache = { version, blob };
        resolve(blob);
      }, 'image/png');
    });
  }

  /** A previously exported blob if it still matches the scene (lets Web Share run inside the click). */
  cachedExport(): Blob | null {
    return this.exportCache && this.exportCache.version === this.version ? this.exportCache.blob : null;
  }

  // ---- input ----

  private toCanvas(e: { clientX: number; clientY: number }): Vec {
    const rect = this.canvas?.getBoundingClientRect();
    return rect ? clientToCanvas(e.clientX, e.clientY, rect) : { x: 0, y: 0 };
  }

  private hitRadius(pointerType: string): number {
    const css = pointerType === 'mouse' ? HANDLE_HIT_RADIUS_MOUSE_CSS : HANDLE_HIT_RADIUS_TOUCH_CSS;
    return css * this.cssScale();
  }

  private hitEye(pt: Vec, pointerType: string): 'left' | 'right' | null {
    if (!this.overlays.laser) return null;
    const r = Math.max(this.eyes.size * 0.9, this.hitRadius(pointerType));
    const dl = dist(pt, this.eyes.left);
    const dr = dist(pt, this.eyes.right);
    if (dl > r && dr > r) return null;
    return dl <= dr ? 'left' : 'right';
  }

  private pickGesture(id: number, pt: Vec, pointerType: string): Gesture | null {
    const hat = this.hats[this.hatIndex];
    const base = this.hitRadius(pointerType);
    type Target = HandleId | 'eye-left' | 'eye-right';
    const candidates: HitCandidate<Target>[] = [];
    if (hat) {
      let radius = base;
      if (pointInHat(pt, this.transform, hat.aspect)) {
        // Inside a small hat the generous touch radius would swallow the whole hat; shrink it so the middle still drags.
        const { w, h } = hatSize(this.transform, hat.aspect);
        radius = Math.min(radius, Math.max(8 * this.cssScale(), Math.min(w, h) * 0.25));
      }
      for (const hnd of handlePositions(this.transform, hat.aspect, this.cssScale())) {
        candidates.push({ id: hnd.id, pos: hnd.pos, radius });
      }
    }
    if (this.overlays.laser) {
      const r = Math.max(this.eyes.size * 0.9, base);
      candidates.push({ id: 'eye-left', pos: this.eyes.left, radius: r });
      candidates.push({ id: 'eye-right', pos: this.eyes.right, radius: r });
    }
    // Nearest target wins, so an eye never steals a handle that is closer. Eyes still beat the hat body.
    const target = pickNearestTarget(pt, candidates);
    if (target === 'eye-left' || target === 'eye-right') {
      const which = target === 'eye-left' ? 'left' : 'right';
      const p = this.eyes[which];
      return { kind: 'eye', which, id, offset: { x: p.x - pt.x, y: p.y - pt.y } };
    }
    if (!hat) return null;
    if (target) return { kind: 'handle', handle: target, id, startPt: pt, start: { ...this.transform } };
    // Anywhere else moves the hat: forgiving on small touch screens.
    return { kind: 'move', id, startPt: pt, start: { ...this.transform } };
  }

  private startPinch(): void {
    const ids = [...this.pointers.keys()].slice(0, 2);
    if (ids.length < 2 || !this.hats[this.hatIndex]) return;
    const a = this.pointers.get(ids[0])!;
    const b = this.pointers.get(ids[1])!;
    this.gesture = { kind: 'pinch', ids: [ids[0], ids[1]], a0: { ...a.pt }, b0: { ...b.pt }, start: { ...this.transform } };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.subject || !this.canvas) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    // preventDefault on pointerdown blocks the implicit focus; focus explicitly for keyboard use afterwards.
    this.canvas.focus({ preventScroll: true });
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // pointer already gone
    }
    const pt = this.toCanvas(e);
    this.pointers.set(e.pointerId, { pt, type: e.pointerType });
    if (this.pointers.size === 1) {
      this.gesture = this.pickGesture(e.pointerId, pt, e.pointerType);
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
    this.updateCursor(pt, e.pointerType);
    this.changed({ scene: false });
  }

  private onPointerMove(e: PointerEvent): void {
    const info = this.pointers.get(e.pointerId);
    const pt = this.toCanvas(e);
    if (!info) {
      if (e.pointerType === 'mouse' && this.subject) this.updateCursor(pt, 'mouse');
      return;
    }
    info.pt = pt;
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (!g.ids.includes(e.pointerId)) return;
      const a = this.pointers.get(g.ids[0]);
      const b = this.pointers.get(g.ids[1]);
      if (!a || !b) return;
      this.setTransform(pinchTransform(g.start, g.a0, g.b0, a.pt, b.pt));
      this.touched = true;
    } else if (g.id !== e.pointerId) {
      return;
    } else if (g.kind === 'eye') {
      const p = {
        x: Math.min(CANVAS_SIZE, Math.max(0, pt.x + g.offset.x)),
        y: Math.min(CANVAS_SIZE, Math.max(0, pt.y + g.offset.y)),
      };
      this.eyes = { ...this.eyes, [g.which]: p };
      this.eyesTouched = true;
    } else if (g.kind === 'move') {
      this.setTransform(moveFromDrag(g.start, g.startPt, pt));
      this.touched = true;
    } else if (g.handle === 'rotate') {
      this.setTransform(rotateFromHandleDrag(g.start, g.startPt, pt));
      this.touched = true;
    } else {
      this.setTransform(scaleFromHandleDrag(g.start, g.startPt, pt));
      this.touched = true;
    }
    this.changed();
  }

  private onPointerEnd(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g?.kind === 'pinch' && g.ids.includes(e.pointerId)) {
      // One finger lifted: continue as a one-finger drag from where the other finger is now, so nothing jumps.
      const restId = g.ids[0] === e.pointerId ? g.ids[1] : g.ids[0];
      const rest = this.pointers.get(restId);
      this.gesture = rest ? { kind: 'move', id: restId, startPt: { ...rest.pt }, start: { ...this.transform } } : null;
    } else if (g && g.kind !== 'pinch' && g.id === e.pointerId) {
      this.gesture = null;
    }
    if (this.pointers.size === 0) this.gesture = null;
    if (this.canvas) this.canvas.style.cursor = '';
    // Publish so slider readouts settle on the final values.
    this.changed({ scene: false });
  }

  private updateCursor(pt: Vec, pointerType: string): void {
    const canvas = this.canvas;
    if (!canvas) return;
    // While a scale handle is held keep its resize cursor; everything else shows a closed hand.
    if (this.gesture) {
      if (this.gesture.kind !== 'handle' || this.gesture.handle === 'rotate') canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.hitEye(pt, pointerType)) {
      canvas.style.cursor = 'move';
      return;
    }
    const hat = this.hats[this.hatIndex];
    const h = hat ? hitHandle(pt, this.transform, hat.aspect, this.cssScale(), this.hitRadius(pointerType)) : null;
    if (h === 'rotate') canvas.style.cursor = 'grab';
    else if (h === 'scale-tl' || h === 'scale-br') canvas.style.cursor = 'nwse-resize';
    else if (h === 'scale-tr' || h === 'scale-bl') canvas.style.cursor = 'nesw-resize';
    else canvas.style.cursor = 'move';
  }

  private onWheel(e: WheelEvent): void {
    // Only pinch-zoom (trackpad pinch arrives as ctrl+wheel). A plain wheel keeps scrolling the page.
    if (!e.ctrlKey || !this.subject) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.setTransform(scaleBy(this.transform, Math.exp(-dy * 0.01)));
    this.touched = true;
    this.changed();
  }

  private onGesture(e: SafariGestureEvent, phase: 'start' | 'change' | 'end'): void {
    e.preventDefault();
    // On iOS these also fire for touch pinches, which the pointer handlers already cover.
    if (!this.subject || this.pointers.size > 0) {
      this.gestureBase = null;
      return;
    }
    if (phase === 'start') {
      this.gestureBase = { scale: this.transform.scale, rotation: this.transform.rotation };
      return;
    }
    if (phase === 'end' || !this.gestureBase) {
      this.gestureBase = null;
      return;
    }
    this.setTransform({
      ...this.transform,
      scale: clampScale(this.gestureBase.scale * e.scale),
      rotation: this.gestureBase.rotation + degToRad(e.rotation),
    });
    this.touched = true;
    this.changed();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.subject || e.altKey || e.metaKey || e.ctrlKey) return;
    const t = this.transform;
    const step = e.shiftKey ? NUDGE_BIG : NUDGE;
    let next: HatTransform | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = { ...t, x: t.x - step };
        break;
      case 'ArrowRight':
        next = { ...t, x: t.x + step };
        break;
      case 'ArrowUp':
        next = { ...t, y: t.y - step };
        break;
      case 'ArrowDown':
        next = { ...t, y: t.y + step };
        break;
      case '+':
      case '=':
        next = scaleBy(t, KEY_SCALE);
        break;
      case '-':
      case '_':
        next = scaleBy(t, 1 / KEY_SCALE);
        break;
      case '[':
        next = { ...t, rotation: t.rotation - KEY_ROT };
        break;
      case ']':
        next = { ...t, rotation: t.rotation + KEY_ROT };
        break;
      case '{':
        next = { ...t, rotation: t.rotation - KEY_ROT_BIG };
        break;
      case '}':
        next = { ...t, rotation: t.rotation + KEY_ROT_BIG };
        break;
      default:
        return;
    }
    e.preventDefault();
    this.setTransform(next);
    this.touched = true;
    this.changed({ sync: true });
  }
}
