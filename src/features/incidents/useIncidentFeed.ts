import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Incident, IncidentsResponse } from '../../../shared/types';
import { getJson } from '../../lib/api';
import { splitFeed } from './feedLogic';

const FEED_URL = '/api/incidents?since=30d&limit=500';
const POLL_MS = 60_000;
const WARMUP_RETRY_MS = 5_000;
const ERROR_RETRY_MS = 15_000;
/** How long inserted items keep their "NEW" marker. */
const FRESH_MS = 30_000;
/** On returning to the tab, refetch right away only if the last attempt is at least this old. */
const VISIBLE_REFETCH_MS = 10_000;

interface State {
  /** True once any real data (not a warm-up response) has arrived. */
  loaded: boolean;
  /** Latest server snapshot, newest first. */
  serverItems: Incident[];
  /** Ids the user has accepted onto the screen. */
  shownIds: Set<string>;
  freshIds: Set<string>;
  sources: string[];
  lastUpdated: Date | null;
  serverLastPollAt: string | null;
  /** Message from the last failed fetch, cleared on success. */
  error: string | null;
}

const INITIAL: State = {
  loaded: false,
  serverItems: [],
  shownIds: new Set(),
  freshIds: new Set(),
  sources: [],
  lastUpdated: null,
  serverLastPollAt: null,
  error: null,
};

export interface IncidentFeed {
  status: 'loading' | 'error' | 'ready';
  /** Displayed items, newest first. */
  items: Incident[];
  /** Fetched items not yet displayed (all of them, unfiltered). */
  pending: Incident[];
  showPending: () => void;
  freshIds: ReadonlySet<string>;
  sources: string[];
  lastUpdated: Date | null;
  serverLastPollAt: string | null;
  /** True when a poll failed but older data is still on screen. */
  signalLost: boolean;
  error: string | null;
  retry: () => void;
}

export function useIncidentFeed(): IncidentFeed {
  const [state, setState] = useState<State>(INITIAL);
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let loaded = false;
    let lastAttempt = 0;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(run, ms);
    };

    async function run() {
      clearTimeout(timer);
      timer = undefined;
      if (disposed) return;
      // Paused while hidden; the visibilitychange handler resumes.
      if (document.visibilityState === 'hidden') return;

      controller?.abort();
      const c = new AbortController();
      controller = c;
      lastAttempt = Date.now();
      try {
        const data = await getJson<IncidentsResponse>(FEED_URL, { signal: c.signal });
        if (disposed || c.signal.aborted) return;

        if (data.lastPollAt === null && data.items.length === 0) {
          // Server is still on its first poll. Not "empty": keep waiting.
          // (After a successful load, keep what we have and poll normally.)
          schedule(loaded ? POLL_MS : WARMUP_RETRY_MS);
          return;
        }

        const now = new Date();
        const firstLoad = !loaded;
        loaded = true;
        setState((s) => ({
          ...s,
          loaded: true,
          serverItems: data.items,
          shownIds: firstLoad ? new Set(data.items.map((i) => i.id)) : s.shownIds,
          sources: data.sources,
          lastUpdated: now,
          serverLastPollAt: data.lastPollAt,
          error: null,
        }));
        schedule(POLL_MS);
      } catch (err) {
        if (disposed || c.signal.aborted) return;
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Request failed' }));
        schedule(loaded ? POLL_MS : ERROR_RETRY_MS);
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timer);
        timer = undefined;
        return;
      }
      const elapsed = Date.now() - lastAttempt;
      if (elapsed >= VISIBLE_REFETCH_MS) void run();
      else schedule(POLL_MS - elapsed);
    };

    retryRef.current = () => {
      setState((s) => ({ ...s, error: null }));
      void run();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void run();

    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      retryRef.current = () => {};
    };
  }, []);

  // Drop the "NEW" markers a while after insertion.
  useEffect(() => {
    if (state.freshIds.size === 0) return;
    const t = setTimeout(() => setState((s) => ({ ...s, freshIds: new Set() })), FRESH_MS);
    return () => clearTimeout(t);
  }, [state.freshIds]);

  const { shown, pending } = useMemo(() => splitFeed(state.serverItems, state.shownIds), [state.serverItems, state.shownIds]);

  const showPending = useCallback(() => {
    setState((s) => {
      const { pending: p } = splitFeed(s.serverItems, s.shownIds);
      if (p.length === 0) return s;
      const shownIds = new Set(s.shownIds);
      const freshIds = new Set(s.freshIds);
      for (const item of p) {
        shownIds.add(item.id);
        freshIds.add(item.id);
      }
      return { ...s, shownIds, freshIds };
    });
  }, []);

  const retry = useCallback(() => retryRef.current(), []);

  const status: IncidentFeed['status'] = state.loaded ? 'ready' : state.error ? 'error' : 'loading';

  return {
    status,
    items: shown,
    pending,
    showPending,
    freshIds: state.freshIds,
    sources: state.sources,
    lastUpdated: state.lastUpdated,
    serverLastPollAt: state.serverLastPollAt,
    signalLost: state.loaded && state.error !== null,
    error: state.error,
    retry,
  };
}
