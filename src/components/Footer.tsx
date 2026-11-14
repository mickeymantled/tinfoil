import { Link } from 'react-router-dom';
import { config, isPlaceholder } from '../config';
import { NAV_LINKS } from './navLinks';
import { SurveillanceReadout } from './SurveillanceReadout';

const EXTERNAL = [
  { key: 'buy', label: `Buy ${config.ticker}`, href: config.links.buy },
  { key: 'chart', label: 'Chart', href: config.links.chart },
  { key: 'x', label: 'X / Twitter', href: config.links.x },
  { key: 'telegram', label: 'Telegram', href: config.links.telegram },
] as const;

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container-site footer-grid">
        <div>
          <p className="nav-wordmark">
            {config.tokenName} <span className="text-amber">{config.ticker}</span>
          </p>
          <p className="mt-3 max-w-sm">
            The cyber incident coin on {config.chain}. Connect the dots. Wear the hat. Stay off the grid (but read this
            site first).
          </p>
          <SurveillanceReadout variant="inline" className="mt-5 lg:hidden" />
        </div>

        <div>
          <h2 className="footer-heading">// FILES</h2>
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="footer-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="footer-heading">// CHANNELS</h2>
          <ul>
            {EXTERNAL.map((l) => (
              <li key={l.key}>
                {isPlaceholder(l.href) ? (
                  <span className="footer-pending" aria-disabled="true">
                    {l.label}
                    <span className="footer-pending-badge">PENDING</span>
                  </span>
                ) : (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="footer-link">
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container-site footer-legal">
        <p>
          <strong>Not financial advice.</strong> {config.ticker} is a memecoin with no intrinsic value and no expectation
          of financial return. Nothing on this site is financial advice. Do your own research.
        </p>
        <p>
          <strong>Incident feed.</strong> The incident feed and ticker aggregate public reporting. Every item links to and
          credits its original source, and headlines are shown as published.
        </p>
        <p>
          <strong>Survival guide.</strong> The survival guide is general preparedness information, not professional
          advice. Follow your local officials, and in an emergency call your local emergency number.
        </p>
        <p>
          <strong>Threat level.</strong> The THREAT LEVEL is a meme metric based only on how many incidents the feed
          picked up in the last 24 hours. It is not an official rating of anything.
        </p>
        <p>
          <strong>Surveillance readout.</strong> The &quot;subject located&quot; readout is a joke built only from your
          browser&apos;s user-agent string. No tracking, no IP lookup, no cookies, no analytics.
        </p>
      </div>

      <div className="container-site footer-bottom">
        &copy; {new Date().getFullYear()} {config.tokenName} // END OF TRANSMISSION
      </div>
    </footer>
  );
}
