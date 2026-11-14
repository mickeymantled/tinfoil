import { useEffect, useState, type RefObject } from 'react';

interface Point {
  x: number;
  y: number;
}

export interface StringGeometry {
  width: number;
  height: number;
  /** One SVG path per pair of consecutive pins. */
  paths: string[];
}

const EMPTY: StringGeometry = { width: 0, height: 0, paths: [] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = (n: number) => Math.round(n * 10) / 10;

/**
 * A string between two pins. Side by side: a gravity sag downwards.
 * Stacked (single column on phones): bow out to the left so the string runs
 * down the board margin instead of across the card text.
 */
function stringPath(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Quadratic peak sits halfway to its control point, so this dips ~sag px.
    const sag = clamp(dist * 0.1, 10, 34);
    const cx = (a.x + b.x) / 2;
    const cy = Math.max(a.y, b.y) + sag * 2;
    return `M${r(a.x)} ${r(a.y)} Q${r(cx)} ${r(cy)} ${r(b.x)} ${r(b.y)}`;
  }
  const bulge = clamp(dist * 0.12, 24, 48);
  const cx = Math.max(2, Math.min(a.x, b.x) - bulge);
  return `M${r(a.x)} ${r(a.y)} C${r(cx)} ${r(a.y + dy * 0.3)} ${r(cx)} ${r(a.y + dy * 0.75)} ${r(b.x)} ${r(b.y)}`;
}

/**
 * Measures elements marked `data-pin` inside the board (in DOM order) relative
 * to the board and returns SVG paths connecting consecutive pins. Re-measures
 * whenever the board or any `data-card` inside it changes size, on window
 * resize, and once web fonts have loaded. Pins that are not laid out yet
 * (zero-size rect) are skipped; with fewer than two, no string is drawn.
 */
export function useRedString(boardRef: RefObject<HTMLElement | null>): StringGeometry {
  const [geom, setGeom] = useState<StringGeometry>(EMPTY);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let raf = 0;
    let disposed = false;

    const measure = () => {
      raf = 0;
      if (disposed) return;
      const b = board.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) {
        setGeom((g) => (g.paths.length ? EMPTY : g));
        return;
      }
      const pins: Point[] = [];
      board.querySelectorAll<HTMLElement>('[data-pin]').forEach((el) => {
        const p = el.getBoundingClientRect();
        if (p.width === 0 && p.height === 0) return;
        // data-pin-y: where the pin head sits, as a fraction of the element's height (default: middle).
        const fy = Number(el.dataset.pinY ?? 0.5);
        pins.push({ x: p.left + p.width / 2 - b.left, y: p.top + p.height * (Number.isFinite(fy) ? fy : 0.5) - b.top });
      });
      const paths: string[] = [];
      for (let i = 0; i + 1 < pins.length; i++) paths.push(stringPath(pins[i], pins[i + 1]));
      const next: StringGeometry = { width: Math.round(b.width), height: Math.round(b.height), paths };
      // Skip the re-render when nothing moved.
      setGeom((g) =>
        g.width === next.width && g.height === next.height && g.paths.join('|') === next.paths.join('|') ? g : next,
      );
    };

    const schedule = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(measure);
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (ro) {
      ro.observe(board);
      board.querySelectorAll('[data-card]').forEach((el) => ro.observe(el));
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    // Web fonts change card heights after first paint.
    document.fonts?.ready.then(schedule).catch(() => {});
    schedule();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [boardRef]);

  return geom;
}
