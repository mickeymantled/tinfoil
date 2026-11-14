import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { config } from '../config';
import { formatCctvDate, formatClock, useNow } from '../lib/time';
import { NAV_LINKS } from './navLinks';

/** CCTV-style local timestamp. Isolated so only it re-renders every second. */
function CctvClock() {
  const now = useNow(1000);
  return (
    <>
      <span className="nav-date">{formatCctvDate(now)}</span>
      <time className="nav-clock" dateTime={new Date(now).toISOString()}>
        {formatClock(now)}
      </time>
    </>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Close on Escape and on taps outside the nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <nav ref={navRef} className="site-nav" aria-label="Main">
      <div className="container-site site-nav-inner">
        <Link to="/" className="nav-brand" aria-label={`${config.tokenName} home`}>
          <img src="/hats/tinfoil-hat.png" alt="" width={643} height={540} decoding="async" />
          <span className="nav-wordmark">{config.tokenName}</span>
          <span className="nav-ticker">{config.ticker}</span>
        </Link>

        <ul className="nav-links">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.to === '/'} className="nav-link">
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          <div className="nav-rec" aria-hidden="true">
            <span className="rec-dot" />
            <span>REC</span>
            <CctvClock />
          </div>
          <button
            ref={burgerRef}
            type="button"
            className="nav-burger"
            aria-expanded={open}
            aria-controls="nav-panel"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="nav-burger-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div id="nav-panel" className="nav-panel" hidden={!open}>
        <ul>
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.to === '/'} className="nav-panel-link" onClick={() => setOpen(false)}>
                <small>{l.file}</small>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="nav-panel-note">
          {config.ticker} // they are watching this menu
        </p>
      </div>
    </nav>
  );
}
