/**
 * Optional, lazy MediaPipe face detection. The library is a separate chunk
 * (dynamic import) and the ~14 MB wasm + model come from CDNs only when this
 * is first called. Every failure resolves to null: manual placement is the
 * primary path and failure is normal (most PFPs are cartoons).
 */
import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { FaceGeometry, Vec } from './geometry';

const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${__MEDIAPIPE_VERSION__}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const MIN_CONFIDENCE = 0.5;

export interface DetectedFace extends FaceGeometry {
  box: { x: number; y: number; w: number; h: number };
  score: number;
}

let detectorPromise: Promise<FaceDetector | null> | null = null;

/** True when the visitor asked the browser to save data (skip the automatic run then). */
export function prefersSaveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

function getDetector(): Promise<FaceDetector | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        return await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          minDetectionConfidence: MIN_CONFIDENCE,
        });
      } catch {
        return null;
      }
    })();
    // Let a later attempt retry if loading failed (flaky network).
    void detectorPromise.then((d) => {
      if (!d) detectorPromise = null;
    });
  }
  return detectorPromise;
}

/**
 * Finds the most prominent face in `canvas` and returns it in that canvas's
 * pixel space, or null. Keypoints from MediaPipe are normalized 0..1; the
 * bounding box is in pixels. BlazeFace keypoint order: right eye, left eye,
 * nose tip, mouth center, right ear, left ear (we do not rely on which eye is
 * which: geometry sorts them by x and uses the mouth to find "up").
 */
export async function detectFace(canvas: HTMLCanvasElement): Promise<DetectedFace | null> {
  try {
    const detector = await getDetector();
    if (!detector) return null;
    const result = detector.detect(canvas);
    const W = canvas.width;
    const H = canvas.height;
    let best: DetectedFace | null = null;
    for (const d of result.detections) {
      const bb = d.boundingBox;
      const kp = d.keypoints;
      if (!bb || kp.length < 2) continue;
      const pt = (i: number): Vec | undefined => (kp[i] ? { x: kp[i].x * W, y: kp[i].y * H } : undefined);
      const eyeA = pt(0);
      const eyeB = pt(1);
      if (!eyeA || !eyeB) continue;
      // Documented as pixels; guard against a normalized box just in case.
      const norm = bb.width <= 1.5 && bb.height <= 1.5;
      const box = norm
        ? { x: bb.originX * W, y: bb.originY * H, w: bb.width * W, h: bb.height * H }
        : { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height };
      if (box.w < 8) continue;
      const face: DetectedFace = {
        eyes: [eyeA, eyeB],
        nose: pt(2),
        mouth: pt(3),
        faceWidth: box.w,
        box,
        score: d.categories[0]?.score ?? 0,
      };
      // Prefer the biggest face: in a PFP that is the subject.
      if (!best || face.box.w * face.box.h > best.box.w * best.box.h) best = face;
    }
    return best;
  } catch {
    return null;
  }
}
