import { useEffect, useState } from 'react';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** 'just now', '14m ago', '3h ago', '2d ago', '5w ago'. Empty string for an unparseable date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  if (diff < MIN) return 'just now'; // includes small clock skew into the future
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return `${Math.floor(diff / WEEK)}w ago`;
}

let dateTimeFormat: Intl.DateTimeFormat | null = null;

/** Local date and time, e.g. 'Nov 13, 2026, 2:38 PM'. Empty string for an unparseable date. */
export function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  dateTimeFormat ??= new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return dateTimeFormat.format(t);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local 24h 'HH:MM:SS'. */
export function formatClock(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Local 'YYYY-MM-DD' (CCTV timestamp style). */
export function formatCctvDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date.now() that re-renders the component every `intervalMs` (default 30s) and when the tab becomes visible. */
export function useNow(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
