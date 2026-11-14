import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Threat, TickerItem, TickerResponse } from '../../shared/types';
import { getJson, isAbortError } from './api';

const ENDPOINT = '/api/incidents/ticker';
const POLL_MS = 60_000;
/** While the server has not finished its first poll yet. */
const WARMUP_MS = 5_000;
/** After a failed fetch when there is nothing cached to show. */
const RETRY_EMPTY_MS = 10_000;

export interface TickerState {
  /** Newest first, up to 25. */
  items: TickerItem[];
  threat: Threat | null;
  /** 'error' only when there is nothing to show. */
  status: 'loading' | 'ready' | 'error';
  /** Server-side last poll time. */
  lastPollAt: string | null;
  error: string | null;
  refresh: () => void;
}

interface Data {
  items: TickerItem[];
  threat: Threat | null;
  lastPollAt: string | null;
  error: string | null;
  /** At least one successful response arrived and the server had finished warming up. */
  settled: boolean;
}

const TickerContext = createContext<TickerState | null>(null);

/** Keeps the previous array when nothing visible changed, so consumers do not re-render needlessly. */
function sameItems(a: TickerItem[], b: TickerItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.title !== y.title || x.publishedAt !== y.publishedAt || x.category !== y.category || x.source !== y.source || x.url !== y.url) {
      return false;
    }
  }
  return true;
}

/** One shared poller for GET /api/incidents/ticker. Mounted once, in Layout. */
export function TickerProvider(props: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ items: [], threat: null, lastPollAt: null, error: null, settled: false });
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let hasItems = false;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = undefined;
      // Paused while hidden; visibilitychange restarts it.
      if (disposed || document.visibilityState === 'hidden') return;
      timer = window.setTimeout(run, ms);
    };

    const run = async () => {
      window.clearTimeout(timer);
      timer = undefined;
      controller?.abort();
      const ctrl = new AbortController();
      controller = ctrl;
      try {
        const res = await getJson<TickerResponse>(ENDPOINT, { signal: ctrl.signal });
        if (disposed || ctrl.signal.aborted) return;
        const items = Array.isArray(res.items) ? res.items : [];
        const warming = res.lastPollAt === null && items.length === 0;
        hasItems = items.length > 0 || (warming && hasItems);
        setData((prev) => {
          const nextItems = warming && prev.items.length ? prev.items : items;
          return {
            items: sameItems(prev.items, nextItems) ? prev.items : nextItems,
            threat: res.threat ?? prev.threat,
            lastPollAt: res.lastPollAt,
            error: null,
            settled: prev.settled || !warming,
          };
        });
        schedule(warming ? WARMUP_MS : POLL_MS);
      } catch (err) {
        if (disposed || isAbortError(err)) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setData((prev) => ({ ...prev, error: message }));
        // Keep showing the last good items; retry sooner if there is nothing on screen.
        schedule(hasItems ? POLL_MS : RETRY_EMPTY_MS);
      } finally {
        if (controller === ctrl) controller = null;
      }
    };

    runRef.current = () => {
      void run();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run();
      } else {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    void run();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      runRef.current = () => {};
    };
  }, []);

  const refresh = useCallback(() => runRef.current(), []);

  const value = useMemo<TickerState>(() => {
    let status: TickerState['status'];
    if (data.items.length > 0) status = 'ready';
    else if (data.error) status = 'error';
    else if (!data.settled) status = 'loading';
    else status = 'ready'; // settled with zero items: consumers show their empty state
    return {
      items: data.items,
      threat: data.threat,
      status,
      lastPollAt: data.lastPollAt,
      error: data.error,
      refresh,
    };
  }, [data, refresh]);

  return <TickerContext.Provider value={value}>{props.children}</TickerContext.Provider>;
}

export function useTicker(): TickerState {
  const ctx = useContext(TickerContext);
  if (!ctx) throw new Error('useTicker must be used inside <TickerProvider>');
  return ctx;
}
