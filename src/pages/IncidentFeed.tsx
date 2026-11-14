import '../styles/feed.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatePanel } from '../components/StatePanel';
import { usePageMeta } from '../lib/usePageMeta';
import { formatClock, timeAgo, useNow } from '../lib/time';
import { CaseFileCard } from '../features/incidents/CaseFileCard';
import { FeedFilters } from '../features/incidents/FeedFilters';
import { useIncidentFeed } from '../features/incidents/useIncidentFeed';
import {
  DEFAULT_RANGE,
  countByCategory,
  hasActiveFilters,
  makeMatcher,
  parseFilters,
  writeFilters,
  type FeedFilters as Filters,
} from '../features/incidents/feedLogic';

const PAGE_SIZE = 30;
const Q_DEBOUNCE_MS = 250;

export default function IncidentFeed() {
  usePageMeta({
    title: 'Incident Feed',
    description:
      'Live feed of real cyber incidents from public security reporting: ransomware, breaches, grid and infrastructure attacks, zero-days. Original headlines, linked to the source.',
  });

  const feed = useIncidentFeed();
  const now = useNow(30_000);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // The search box is local state so typing never fights the router; the URL copy is debounced.
  const [qInput, setQInput] = useState(urlFilters.q);
  const lastWrittenQ = useRef(urlFilters.q);
  useEffect(() => {
    // URL changed from outside (a link, CLEAR FILTERS): adopt it.
    if (urlFilters.q !== lastWrittenQ.current) {
      lastWrittenQ.current = urlFilters.q;
      setQInput(urlFilters.q);
    }
  }, [urlFilters.q]);

  const commit = useCallback(
    (next: Filters) => {
      lastWrittenQ.current = next.q.trim();
      setSearchParams((prev) => writeFilters(prev, next), { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (qInput.trim() === urlFilters.q.trim()) return;
    const t = setTimeout(() => commit({ ...urlFilters, q: qInput }), Q_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [qInput, urlFilters, commit]);

  // Filtering uses the live search text so results are instant.
  const filters: Filters = useMemo(() => ({ ...urlFilters, q: qInput }), [urlFilters, qInput]);
  const active = hasActiveFilters(filters);

  const clearFilters = useCallback(() => {
    setQInput('');
    commit({ categories: [], source: '', range: DEFAULT_RANGE, q: '' });
  }, [commit]);

  const match = useMemo(() => makeMatcher(filters, now), [filters, now]);
  const matched = useMemo(() => feed.items.filter(match), [feed.items, match]);
  const pendingMatched = useMemo(() => feed.pending.filter(match).length, [feed.pending, match]);
  const categoryCounts = useMemo(
    () => countByCategory(feed.items, makeMatcher(filters, now, true)),
    [feed.items, filters, now],
  );

  // "LOAD MORE" window, reset whenever the filters change.
  const filterKey = `${filters.categories.join(',')}|${filters.source}|${filters.range}|${filters.q.trim().toLowerCase()}`;
  const [windowState, setWindowState] = useState({ key: filterKey, n: PAGE_SIZE });
  const visibleCount = windowState.key === filterKey ? windowState.n : PAGE_SIZE;
  const visible = matched.slice(0, visibleCount);

  const listTopRef = useRef<HTMLDivElement>(null);
  const onShowPending = () => {
    // Grow the window so the inserted cards do not push existing ones out of view.
    setWindowState({ key: filterKey, n: visibleCount + pendingMatched });
    feed.showPending();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      listTopRef.current?.focus({ preventScroll: true });
    });
  };

  let body: ReactNode;
  if (feed.status === 'loading') {
    body = (
      <StatePanel kind="loading" title="DECRYPTING CASE FILES">
        Pulling the latest reports from public sources. Stay calm. Act natural.
      </StatePanel>
    );
  } else if (feed.status === 'error') {
    body = (
      <StatePanel
        kind="error"
        title="SIGNAL LOST"
        action={
          <button type="button" className="btn btn-primary" onClick={feed.retry}>
            RETRY
          </button>
        }
      >
        Could not reach the incident archive. Either the server is down or they cut the line. Retrying on its own too.
      </StatePanel>
    );
  } else if (feed.items.length === 0 && feed.pending.length === 0) {
    body = (
      <StatePanel kind="empty" title="NO FILES YET">
        The archive is empty for the last 30 days. Suspiciously quiet. We will check again every minute.
      </StatePanel>
    );
  } else if (matched.length === 0) {
    body = (
      <StatePanel
        kind="empty"
        title="NO FILES MATCH"
        action={
          active ? (
            <button type="button" className="btn btn-amber" onClick={clearFilters}>
              CLEAR FILTERS
            </button>
          ) : undefined
        }
      >
        Nothing in the archive matches these filters. Either it never happened, or it was scrubbed.
      </StatePanel>
    );
  } else {
    body = (
      <>
        <ol className="feed-grid" aria-label="Case files">
          {visible.map((item) => (
            <li key={item.id}>
              <CaseFileCard incident={item} now={now} fresh={feed.freshIds.has(item.id)} headingLevel="h2" />
            </li>
          ))}
        </ol>
        {matched.length > visibleCount && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWindowState({ key: filterKey, n: visibleCount + PAGE_SIZE })}
            >
              LOAD MORE FILES ({matched.length - visibleCount} REMAINING)
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="container-site py-8 sm:py-12">
      <PageHeader
        fileNo="FILE 003"
        title="INCIDENT FEED"
        stamp="DECLASSIFIED"
        subtitle={
          <>
            <span className="block">Every breach, every blackout, every zero-day. Connect the dots yourself.</span>
            <span className="mt-2 block text-sm">
              These are real reports from public security sources, shown with their original headlines and linked to
              the original articles.
            </span>
          </>
        }
      />

      <div>
        <FeedFilters
          filters={urlFilters}
          qInput={qInput}
          onQInput={setQInput}
          onChange={(next) => commit({ ...next, q: qInput })}
          onClear={clearFilters}
          sources={feed.sources}
          categoryCounts={categoryCounts}
        />
      </div>

      <div className="feed-status">
        <p className="feed-status__count">
          <span className="text-amber">{feed.status === 'ready' ? matched.length : '--'}</span>{' '}
          {matched.length === 1 ? 'FILE' : 'FILES'}
        </p>
        <p className="feed-status__updated">
          <span className="rec-dot" aria-hidden="true" /> LAST UPDATED{' '}
          {feed.lastUpdated ? (
            <>
              <time dateTime={feed.lastUpdated.toISOString()}>{formatClock(feed.lastUpdated)}</time>{' '}
              <span className="text-phosphor-dim">({timeAgo(feed.lastUpdated.toISOString(), now)})</span>
            </>
          ) : (
            <span>--:--:--</span>
          )}
        </p>
        {feed.signalLost && (
          <p className="feed-status__lost">SIGNAL LOST, RETRYING. Showing the last files we intercepted.</p>
        )}
      </div>

      {/* Sticky "NEW INTEL" pill. The live region stays mounted so additions are announced. */}
      <div className="feed-pill-wrap" aria-live="polite">
        {/* Only offer the pill when at least one new item would actually appear under the current filters. */}
        {pendingMatched > 0 && (
          <button type="button" className="feed-pill" onClick={onShowPending}>
            <span className="rec-dot" aria-hidden="true" />
            NEW INTEL ({pendingMatched})
            {pendingMatched !== feed.pending.length && (
              <span className="sr-only"> matching your filters, {feed.pending.length} in total</span>
            )}
          </button>
        )}
      </div>

      <div ref={listTopRef} tabIndex={-1} className="feed-list-top" aria-label="Case file list" />
      {body}
    </div>
  );
}
