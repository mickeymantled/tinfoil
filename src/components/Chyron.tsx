import { useCallback, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import type { Threat, TickerItem } from '../../shared/types';
import { useTicker } from '../lib/ticker';
import { timeAgo, useNow } from '../lib/time';
import { CategoryTag } from './CategoryTag';

/** Marquee speed in px/s. Slower below lg so phones stay readable. */
const SPEED_DESKTOP = 80;
const SPEED_MOBILE = 55;
const MIN_DURATION_S = 20;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ThreatIndicator({ threat }: { threat: Threat | null }) {
  const level = threat ? threat.level : 'CALIBRATING';
  const count = threat ? threat.count24h : null;
  return (
    <div className="chyron-threat" data-level={threat ? threat.index : undefined}>
      <p className="sr-only">
        {threat
          ? `Threat level: ${threat.level}, based on ${threat.count24h} incidents reported in the last 24 hours. Meme metric, not an official rating.`
          : 'Threat level: calibrating. Meme metric, not an official rating.'}
      </p>
      <div className="threat-main" aria-hidden="true">
        <span className="threat-label">
          <span className="threat-label-short">THREAT</span>
          <span className="threat-label-long">THREAT LEVEL</span>
        </span>
        <span className="threat-meter">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} data-on={threat ? i <= threat.index : false} />
          ))}
        </span>
        <span className="threat-level">{level}</span>
        {count !== null ? <span className="threat-count">{count} IN 24H</span> : null}
      </div>
      <p className="threat-note" aria-hidden="true">
        <span>MEME METRIC,</span> <span>NOT AN OFFICIAL RATING</span>
      </p>
    </div>
  );
}

function Headline({ item, now, hidden }: { item: TickerItem; now: number; hidden: boolean }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="chyron-item"
      tabIndex={hidden ? -1 : undefined}
    >
      <CategoryTag category={item.category} />
      <span className="chyron-title">{item.title}</span>
      <span className="chyron-meta">
        <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt, now)}</time>
        <span aria-hidden="true"> // </span>
        <span className="chyron-source">{item.source}</span>
      </span>
    </a>
  );
}

function Marquee({ items }: { items: TickerItem[] }) {
  const now = useNow(30_000);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLUListElement>(null);
  // Copies of the item list inside one group, so a short list still fills the viewport.
  const [reps, setReps] = useState(1);
  const [duration, setDuration] = useState(0);
  const repsRef = useRef(1);
  const durationRef = useRef(0);

  useLayoutEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  // Constant speed: duration = one group's width / px per second, re-measured on any size change.
  useLayoutEffect(() => {
    const group = groupRef.current;
    const viewport = viewportRef.current;
    if (!group || !viewport) return;
    const measure = () => {
      const groupW = group.offsetWidth;
      const viewW = viewport.clientWidth;
      if (!groupW) return;
      const base = groupW / repsRef.current;
      const wanted = prefersReducedMotion() ? 1 : Math.max(1, Math.ceil(viewW / base));
      if (wanted !== repsRef.current) {
        repsRef.current = wanted;
        setReps(wanted);
        return; // the group resizes and the observer fires again
      }
      const speed = window.matchMedia('(min-width: 1024px)').matches ? SPEED_DESKTOP : SPEED_MOBILE;
      setDuration(Math.max(MIN_DURATION_S, Math.round((groupW / speed) * 10) / 10));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(group);
    ro.observe(viewport);
    measure();
    return () => ro.disconnect();
  }, []);

  // Apply a new duration without visibly restarting: keep the same elapsed time within the loop
  // (at constant speed, same elapsed time means same pixel offset).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !duration) return;
    const prev = durationRef.current;
    durationRef.current = duration;
    let anim: Animation | undefined;
    let elapsed: number | null = null;
    if (prev && typeof track.getAnimations === 'function') {
      anim = track.getAnimations()[0];
      const t = anim?.currentTime;
      if (typeof t === 'number') elapsed = t % (prev * 1000);
    }
    track.style.setProperty('--chyron-duration', `${duration}s`);
    if (anim && elapsed !== null) {
      void getComputedStyle(track).animationDuration; // flush so the new duration applies first
      try {
        anim.currentTime = elapsed % (duration * 1000);
      } catch {
        /* not fatal: worst case the loop jumps once */
      }
    }
  }, [duration]);

  // Focusing a link inside the clipped viewport scrolls it; undo that when focus leaves.
  const onBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || prefersReducedMotion()) return;
    if (!viewport.contains(e.relatedTarget as Node | null)) viewport.scrollLeft = 0;
  }, []);

  const renderGroup = (dup: boolean) => (
    <ul className="chyron-group" ref={dup ? undefined : groupRef} aria-hidden={dup || undefined}>
      {Array.from({ length: reps }, (_, r) =>
        items.map((item) => (
          <li
            key={`${r}:${item.id}`}
            className="chyron-li"
            data-rep={r > 0 ? r : undefined}
            aria-hidden={!dup && r > 0 ? true : undefined}
          >
            <Headline item={item} now={now} hidden={dup || r > 0} />
            <span className="chyron-sep" aria-hidden="true">
              ///
            </span>
          </li>
        )),
      )}
    </ul>
  );

  return (
    <div ref={viewportRef} className="chyron-viewport" onBlur={onBlur}>
      <div ref={trackRef} className="chyron-track">
        {renderGroup(false)}
        {renderGroup(true)}
      </div>
    </div>
  );
}

/** Cable-news style incident ticker fixed to the bottom of every page. */
export function Chyron() {
  const { items, threat, status } = useTicker();

  let body: ReactNode;
  if (items.length > 0) {
    body = <Marquee items={items} />;
  } else if (status === 'loading') {
    body = (
      <p className="chyron-status" role="status">
        <span className="cursor-blink">ESTABLISHING UPLINK...</span>
      </p>
    );
  } else if (status === 'error') {
    body = (
      <p className="chyron-status chyron-status-error" role="status">
        SIGNAL LOST. RETRYING...
      </p>
    );
  } else {
    body = (
      <p className="chyron-status chyron-status-empty" role="status">
        NO INCIDENTS ON THE WIRE. SUSPICIOUSLY QUIET.
      </p>
    );
  }

  return (
    <section className="chyron" aria-label="Live cyber incident ticker">
      <ThreatIndicator threat={threat} />
      <div className="chyron-main">
        <div className="chyron-live" aria-hidden="true">
          <span className="rec-dot" />
          LIVE
        </div>
        {body}
      </div>
    </section>
  );
}
