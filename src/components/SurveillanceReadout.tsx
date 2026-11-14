import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';
import { describeUserAgent } from '../lib/userAgent';

/** Past this scroll offset the floating readout collapses to a chip for the rest of the page view. */
const COLLAPSE_AT = 120;

/**
 * Fake CCTV readout. Built only from navigator.userAgent: no network calls,
 * no storage, nothing leaves the browser.
 * 'floating': fixed bottom-right, lg+ only. Expanded only near the top of the
 *   page, then a small chip (button) that toggles the full readout.
 * 'inline': rendered in the footer below lg.
 */
export function SurveillanceReadout(props: { variant: 'floating' | 'inline'; className?: string }) {
  const { variant, className } = props;
  const floating = variant === 'floating';
  const { pathname } = useLocation();
  const bodyId = useId();
  const [dismissed, setDismissed] = useState(false);
  /** Auto-collapsed after scrolling (sticky for the page view). */
  const [collapsed, setCollapsed] = useState(false);
  /** Opened deliberately from the chip. */
  const [open, setOpen] = useState(false);
  const subject = useMemo(
    () => describeUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent),
    [],
  );

  // New page view: start expanded only if the new page is at the top. Runs after Layout's scroll-to-top.
  useEffect(() => {
    if (!floating) return;
    setOpen(false);
    setDismissed(false);
    // Only the home page has free space in that corner at the top. Everywhere
    // else the full readout would sit on page controls, so start as the chip.
    setCollapsed(pathname !== '/' || window.scrollY >= COLLAPSE_AT);
  }, [floating, pathname]);

  // While expanded, collapse once the user scrolls past the threshold, then stop listening.
  useEffect(() => {
    if (!floating || collapsed || dismissed) return;
    const onScroll = () => {
      if (window.scrollY >= COLLAPSE_AT) setCollapsed(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [floating, collapsed, dismissed]);

  if (dismissed) return null;

  const body = (
    <>
      <p className="surveillance-row">
        SUBJECT LOCATED: <b>{subject.browser}</b> / <b>{subject.os}</b>
      </p>
      <p className="surveillance-row">
        SIGNAL: <span className="surveillance-bad">COMPROMISED</span>
      </p>
      <p className="surveillance-note">
        Joke. Read from your browser&apos;s user-agent string only. Nothing is tracked or sent anywhere.
      </p>
    </>
  );

  if (!floating) {
    return (
      <aside className={cn('surveillance no-print surveillance-inline', className)} aria-label="Joke surveillance readout">
        <div className="surveillance-head">
          <span className="rec-dot" aria-hidden="true" />
          <span>CAM 07 // LIVE</span>
        </div>
        {body}
      </aside>
    );
  }

  const expanded = !collapsed || open;
  const toggle = () => {
    if (expanded) {
      setCollapsed(true);
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  return (
    <aside
      className={cn('surveillance no-print surveillance-floating', className)}
      data-state={expanded ? 'expanded' : 'compact'}
      aria-label="Joke surveillance readout"
    >
      <div className="surveillance-head">
        <button
          type="button"
          className="surveillance-chip"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <span className="rec-dot" aria-hidden="true" />
          <span>CAM 07 // LIVE</span>
        </button>
        <button
          type="button"
          className="surveillance-close"
          aria-label="Dismiss surveillance readout"
          onClick={() => setDismissed(true)}
        >
          X
        </button>
      </div>
      <div id={bodyId} className="surveillance-body">
        {body}
      </div>
    </aside>
  );
}
