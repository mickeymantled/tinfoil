import '../styles/hat.css';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import hatList from 'virtual:hats';
import { PageHeader } from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { config } from '../config';
import { HatEditor, MAX_EYE_SIZE, MIN_EYE_SIZE, type OverlayKey } from '../hat/editor';
import {
  ImageInputError,
  TEST_SUBJECT_EYES,
  decodeUserImage,
  loadHats,
  makeTestSubject,
  type LoadedHat,
} from '../hat/assets';
import { detectFace, prefersSaveData } from '../hat/faceDetect';
import { MAX_SCALE, MIN_SCALE, degToRad, radToDeg } from '../hat/geometry';

const EXPORT_NAME = 'tinfoil-hat-pfp.png';

type HatsStatus = 'loading' | 'ready' | 'error';
type FaceStatus = 'idle' | 'scanning' | 'found' | 'kept' | 'none' | 'saver';

const FACE_STATUS_TEXT: Record<FaceStatus, string> = {
  idle: 'MANUAL MODE',
  scanning: 'SCANNING FOR A FACE...',
  found: 'FACE LOCKED. HAT AUTO-PLACED.',
  kept: 'FACE FOUND. KEPT YOUR PLACEMENT.',
  none: 'MANUAL MODE',
  saver: 'MANUAL MODE (DATA SAVER ON)',
};

function canShareFiles(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') {
      return false;
    }
    return navigator.canShare({ files: [new File([new Uint8Array(1)], EXPORT_NAME, { type: 'image/png' })] });
  } catch {
    return false;
  }
}

function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
}

function errorName(err: unknown): string {
  return err instanceof Error || err instanceof DOMException ? err.name : '';
}

/* ---------- small presentational pieces ---------- */

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel hat-group" aria-label={title}>
      <h2 className="panel-title">{title}</h2>
      <div className="hat-group-body">{children}</div>
    </section>
  );
}

function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="hat-toggle-row">
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.checked)}
          aria-describedby={props.hint ? `${id}-hint` : undefined}
        />
        <span>{props.label}</span>
      </label>
      {props.hint && (
        <p id={`${id}-hint`} className="hat-hint">
          {props.hint}
        </p>
      )}
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="hat-slider">
      <div className="hat-slider-head">
        <label htmlFor={id}>{props.label}</label>
        <output htmlFor={id} className="hat-readout">
          {props.value}
          {props.unit}
        </output>
      </div>
      <input
        id={id}
        className="range w-full"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        aria-valuetext={`${props.value}${props.unit === '°' ? ' degrees' : props.unit}`}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ---------- page ---------- */

export default function HatGenerator() {
  usePageMeta({
    title: 'Hat Generator',
    description: `Make a ${config.ticker} tinfoil hat PFP in your browser. Upload, paste or drop a photo, place the hat, download a 1000x1000 PNG. Your image never leaves your device.`,
  });

  const [editor] = useState(() => new HatEditor());
  const snap = useSyncExternalStore(editor.subscribe, editor.getSnapshot);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hatsStatus, setHatsStatus] = useState<HatsStatus>(hatList.length ? 'loading' : 'error');
  const [loadedHats, setLoadedHats] = useState<LoadedHat[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('idle');
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [shareSupported] = useState(canShareFiles);
  const [clipboardSupported] = useState(canReadClipboard);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const loadToken = useRef(0);
  const detectToken = useRef(0);
  const exportRef = useRef<{ url: string; blob: Blob } | null>(null);

  const announce = useCallback((text: string) => {
    // Alternate a trailing space so repeating the same message is announced again.
    setAnnouncement((prev) => (prev === text ? `${text} ` : text));
  }, []);

  /* canvases */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return editor.attach(canvas);
  }, [editor]);

  useEffect(() => {
    editor.setPreview(previewRef.current);
    return () => editor.setPreview(null);
  }, [editor]);

  /* hats */
  useEffect(() => {
    if (!hatList.length) return;
    let alive = true;
    loadHats(hatList).then((loaded) => {
      if (!alive) return;
      if (!loaded.length) {
        setHatsStatus('error');
        return;
      }
      editor.setHats(loaded);
      setLoadedHats(loaded);
      setHatsStatus('ready');
    });
    return () => {
      alive = false;
    };
  }, [editor]);

  /* export URL lifetime: revoke the previous one, and on unmount */
  const setExportBlob = useCallback((blob: Blob): string => {
    if (exportRef.current?.blob === blob) return exportRef.current.url;
    if (exportRef.current) URL.revokeObjectURL(exportRef.current.url);
    const url = URL.createObjectURL(blob);
    exportRef.current = { url, blob };
    setExportUrl(url);
    return url;
  }, []);

  const clearExport = useCallback(() => {
    if (exportRef.current) URL.revokeObjectURL(exportRef.current.url);
    exportRef.current = null;
    setExportUrl(null);
  }, []);

  useEffect(
    () => () => {
      if (exportRef.current) URL.revokeObjectURL(exportRef.current.url);
      exportRef.current = null;
    },
    [],
  );

  /* face detection (optional, silent on failure) */
  const runDetection = useCallback(
    async (force: boolean) => {
      if (!config.faceDetection) return;
      const canvas = editor.getSubjectCanvas();
      if (!canvas) return;
      const token = ++detectToken.current;
      setFaceStatus('scanning');
      const face = await detectFace(canvas);
      // Ignore stale results: a new image, a new fit, or a newer run.
      if (token !== detectToken.current || editor.getSubjectCanvas() !== canvas) return;
      if (!face) {
        setFaceStatus('none');
        if (force) announce('No face found. Manual mode: drag the hat into place.');
        return;
      }
      const applied = editor.applyFace(face, force);
      setFaceStatus(applied ? 'found' : 'kept');
      if (applied) announce('Face found. Hat auto-placed.');
    },
    [editor, announce],
  );

  const autoDetectIfAllowed = useCallback(() => {
    if (!config.faceDetection) return;
    if (prefersSaveData()) {
      setFaceStatus('saver');
      return;
    }
    void runDetection(false);
  }, [runDetection]);

  /* input */
  const handleFile = useCallback(
    async (file: Blob & { name?: string }) => {
      const token = ++loadToken.current;
      setMessage(null);
      setBusy(true);
      try {
        const source = await decodeUserImage(file);
        if (token !== loadToken.current) return;
        detectToken.current++;
        setFaceStatus('idle');
        editor.setSubject(source);
        clearExport();
        announce('Subject loaded. Hat deployed. Drag it to adjust.');
        autoDetectIfAllowed();
      } catch (err) {
        if (token !== loadToken.current) return;
        const text =
          err instanceof ImageInputError
            ? err.message
            : 'Could not read that image. Try a JPG or PNG.';
        setMessage(text); // the message element is a polite live region
      } finally {
        if (token === loadToken.current) setBusy(false);
      }
    },
    [editor, clearExport, announce, autoDetectIfAllowed],
  );

  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;

  // Paste anywhere on the page while it is mounted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let sawFile = false;
      for (const item of items) {
        if (item.kind !== 'file') continue;
        sawFile = true;
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            void handleFileRef.current(f);
            return;
          }
        }
      }
      if (sawFile) setMessage('That is not an image. Paste a JPG, PNG, WEBP or GIF.');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const pasteFromClipboard = async () => {
    setMessage(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await handleFile(new File([blob], `pasted.${type.split('/')[1] || 'png'}`, { type }));
          return;
        }
      }
      setMessage('No image on the clipboard. Copy an image first, then tap PASTE IMAGE.');
    } catch {
      setMessage('Could not read the clipboard. Allow clipboard access when asked, or press Ctrl+V / Cmd+V.');
    }
  };

  const loadTestSubject = () => {
    loadToken.current++;
    detectToken.current++;
    setBusy(false);
    setMessage(null);
    setFaceStatus('idle');
    editor.setSubject(makeTestSubject(), { isTest: true, eyes: TEST_SUBJECT_EYES });
    clearExport();
    announce('Test subject loaded. Hat deployed. Drag it to adjust.');
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (f) void handleFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
    else setMessage('Drop an image file (JPG, PNG, WEBP or GIF).');
  };

  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const onFitChange = (contain: boolean) => {
    editor.setFit(contain ? 'contain' : 'cover');
    detectToken.current++;
    if (!snap.isTestSubject && !snap.touched) autoDetectIfAllowed();
    else setFaceStatus('idle');
  };

  const onOverlay = (key: OverlayKey) => (on: boolean) => editor.setOverlay(key, on);

  /* export */
  const download = async () => {
    try {
      const blob = await editor.exportBlob();
      const url = setExportBlob(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = EXPORT_NAME;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage(null);
      announce('PNG exported. If nothing downloaded, long-press the image below to save it.');
    } catch {
      setMessage('Export failed. Try again, or take a screenshot of the canvas.');
    }
  };

  const share = async () => {
    // Use the cached PNG when it is current, so navigator.share runs inside the tap (Safari needs that).
    let blob = editor.cachedExport();
    try {
      if (!blob) blob = await editor.exportBlob();
      setExportBlob(blob);
      const file = new File([blob], EXPORT_NAME, { type: 'image/png' });
      await navigator.share({ files: [file], text: `${config.shareText} ${siteUrl}` });
      announce('Shared.');
    } catch (err) {
      const name = errorName(err);
      if (name === 'AbortError') return; // user closed the share sheet
      setMessage(
        name === 'NotAllowedError'
          ? 'Image ready. Tap SAVE / SHARE IMAGE again, or long-press the image below to save it.'
          : 'Sharing did not work here. Long-press the image below to save it, or use DOWNLOAD PNG.',
      );
    }
  };

  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(`${config.shareText} ${siteUrl}`.trim())}`;

  const has = snap.hasSubject;
  const hatsReady = hatsStatus === 'ready';
  const canEdit = has && hatsReady;
  const scalePct = Math.round(snap.transform.scale * 100);
  const rotDeg = Math.round(radToDeg(snap.transform.rotation));
  const faceUi = config.faceDetection && has && !snap.isTestSubject;

  const uploadButtons = (small: boolean) => (
    <>
      <button type="button" className={`btn btn-primary${small ? ' btn-sm' : ''}`} onClick={() => fileRef.current?.click()}>
        UPLOAD IMAGE
      </button>
      {clipboardSupported && (
        <button type="button" className={`btn btn-ghost${small ? ' btn-sm' : ''}`} onClick={pasteFromClipboard}>
          PASTE IMAGE
        </button>
      )}
    </>
  );

  return (
    <div className="container-site py-8 sm:py-12">
      <PageHeader
        fileNo="FILE 002"
        title="HAT GENERATOR"
        stamp="EYES ONLY"
        subtitle={
          <>
            Protect the cranium. Load a SUBJECT, deploy the foil, download your new PFP.
            <br />
            <strong className="text-phosphor">Your image never leaves your device.</strong> Everything happens in this
            browser tab. Nothing is uploaded.
          </>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileInput}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {hatsStatus === 'error' && (
        <div className="panel hat-error mb-6" role="alert">
          <h2 className="panel-title">HAT ASSET MISSING</h2>
          <p>
            The hat image could not be loaded, so there is nothing to put on your head yet. Site owner: add a
            transparent PNG at <code>public/hats/tinfoil-hat.png</code> (the bottom edge of the image is the brim) and
            rebuild.
          </p>
        </div>
      )}

      <div className="hat-layout">
        {/* ---- stage + primary actions ---- */}
        <div className="hat-main">
          <div
            className={`hat-stage${dragOver ? ' is-dragover' : ''}`}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <canvas
              ref={canvasRef}
              width={1000}
              height={1000}
              className="hat-canvas"
              tabIndex={canEdit ? 0 : -1}
              role="application"
              aria-label="Hat editor. Drag anywhere to move the hat, drag a corner to resize, drag the round handle below the brim to rotate, or pinch and twist with two fingers. Keyboard: arrow keys move the hat (hold Shift for bigger steps), plus and minus resize, [ and ] rotate."
              aria-describedby="hat-help"
            >
              Your browser does not support canvas, so the hat generator cannot run here.
            </canvas>

            {!has && (
              <div className="hat-dropzone">
                <p className="hat-dropzone-title heading-crt">NO SUBJECT LOADED</p>
                <p className="hat-dropzone-copy">
                  Drop a photo here, upload one, or paste it. Faces, cats, cartoons: all craniums deserve protection.
                </p>
                <div className="hat-dropzone-actions">
                  {uploadButtons(false)}
                  <button type="button" className="btn btn-amber" onClick={loadTestSubject} disabled={!hatsReady}>
                    TRY A TEST SUBJECT
                  </button>
                </div>
                <p className="hat-hint">JPG, PNG, WEBP or GIF, up to 25 MB. Stays on your device.</p>
              </div>
            )}

            {dragOver && (
              <div className="hat-drop-hint" aria-hidden="true">
                RELEASE TO LOAD SUBJECT
              </div>
            )}

            {busy && (
              <div className="hat-busy" aria-hidden="true">
                DECODING SUBJECT...
              </div>
            )}
          </div>

          {message && (
            <p className="hat-message" role="status">
              {message}
            </p>
          )}

          <div className="hat-statusbar">
            <p id="hat-help" className="hat-hint">
              Drag to move. Corners resize. Round handle rotates. Two fingers: pinch and twist.
            </p>
            {faceUi && (
              <p className="hat-face-status" aria-live="off">
                <span aria-hidden="true">{faceStatus === 'scanning' ? '◌ ' : '● '}</span>
                {FACE_STATUS_TEXT[faceStatus]}
              </p>
            )}
          </div>

          <section className="panel hat-actions" aria-label="Export">
            <div className="hat-actions-row">
              <button type="button" className="btn btn-primary" onClick={download} disabled={!canEdit}>
                DOWNLOAD PNG
              </button>
              {shareSupported && (
                <button type="button" className="btn btn-ghost" onClick={share} disabled={!canEdit}>
                  SAVE / SHARE IMAGE
                </button>
              )}
              <a className="btn btn-amber" href={xUrl} target="_blank" rel="noopener noreferrer">
                SHARE ON X
              </a>
            </div>
            <p className="hat-hint">
              SHARE ON X opens a prefilled post with {config.ticker}. X cannot attach the image for you: download it
              first, then add it to the post yourself.
            </p>
            {exportUrl && (
              <figure className="hat-export">
                <img src={exportUrl} alt="Your exported tinfoil hat PFP" width={1000} height={1000} />
                <figcaption className="hat-hint">
                  Exported 1000x1000 PNG. Download blocked (in-app browser)? Long-press or right-click the image to
                  save it.
                </figcaption>
              </figure>
            )}
          </section>
        </div>

        {/* ---- controls ---- */}
        <div className="hat-controls">
          <ControlGroup title="SUBJECT">
            <div className="hat-button-row">
              {uploadButtons(true)}
              <button type="button" className="btn btn-amber btn-sm" onClick={loadTestSubject} disabled={!hatsReady}>
                TEST SUBJECT
              </button>
            </div>
            <Toggle
              label="Show whole image (no crop)"
              checked={snap.fit === 'contain'}
              onChange={onFitChange}
              disabled={!has}
              hint="Off: fills the square and crops the edges. On: fits the whole image on a dark background."
            />
          </ControlGroup>

          <ControlGroup title="HAT">
            {loadedHats.length > 1 && (
              <div className="hat-picker" role="group" aria-label="Choose a hat">
                {loadedHats.map((h, i) => (
                  <button
                    key={h.asset.file}
                    type="button"
                    className={`hat-thumb${i === snap.hatIndex ? ' is-active' : ''}`}
                    aria-pressed={i === snap.hatIndex}
                    aria-label={h.asset.name}
                    title={h.asset.name}
                    onClick={() => editor.selectHat(i)}
                  >
                    <img src={h.asset.url} alt="" />
                  </button>
                ))}
              </div>
            )}
            <Slider
              label="Size"
              value={scalePct}
              min={Math.round(MIN_SCALE * 100)}
              max={Math.round(MAX_SCALE * 100)}
              unit="%"
              disabled={!canEdit}
              onChange={(v) => editor.setScale(v / 100)}
            />
            <Slider
              label="Rotation"
              value={rotDeg}
              min={-180}
              max={180}
              unit="°"
              disabled={!canEdit}
              onChange={(v) => editor.setRotation(degToRad(v))}
            />
            <div className="hat-button-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => editor.toggleFlip()}
                disabled={!canEdit}
                aria-pressed={snap.transform.flip}
              >
                FLIP
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => editor.resetPlacement()} disabled={!canEdit}>
                RESET
              </button>
              {faceUi && (
                <button
                  type="button"
                  className="btn btn-amber btn-sm"
                  onClick={() => void runDetection(true)}
                  disabled={!canEdit || faceStatus === 'scanning'}
                  title="Find a face in your image and place the hat on it. Downloads a face detector (about 14 MB) the first time."
                >
                  {faceStatus === 'scanning' ? 'SCANNING...' : 'AUTO-PLACE'}
                </button>
              )}
            </div>
            {faceUi && (
              <p className="hat-hint">
                AUTO-PLACE looks for a face in this browser (detector downloads once, about 14 MB). Works on photos,
                usually not on cartoons.
              </p>
            )}
          </ControlGroup>

          <ControlGroup title="OVERLAYS">
            <Toggle label="Laser eyes" checked={snap.overlays.laser} onChange={onOverlay('laser')} disabled={!canEdit} />
            {snap.overlays.laser && (
              <>
                <Slider
                  label="Laser size"
                  value={Math.round(snap.eyeSize)}
                  min={MIN_EYE_SIZE}
                  max={MAX_EYE_SIZE}
                  unit="px"
                  disabled={!canEdit}
                  onChange={(v) => editor.setEyeSize(v)}
                />
                <p className="hat-hint">Drag the dashed circles on the image to aim each eye.</p>
              </>
            )}
            <Toggle label="CLASSIFIED stamp" checked={snap.overlays.stamp} onChange={onOverlay('stamp')} disabled={!canEdit} />
            <Toggle label="Scanlines" checked={snap.overlays.scanlines} onChange={onOverlay('scanlines')} disabled={!canEdit} />
          </ControlGroup>

          <ControlGroup title="PFP PREVIEW">
            <div className="hat-preview-row">
              <canvas
                ref={previewRef}
                width={256}
                height={256}
                className="hat-preview"
                role="img"
                aria-label="Round preview of your PFP"
              />
              <div className="min-w-0 flex-1">
                <Toggle
                  label="Circle guide"
                  checked={snap.circleGuide}
                  onChange={(on) => editor.setCircleGuide(on)}
                  disabled={!has}
                  hint="Dims what a round avatar crops off. Never included in the download."
                />
              </div>
            </div>
          </ControlGroup>
        </div>
      </div>
    </div>
  );
}
