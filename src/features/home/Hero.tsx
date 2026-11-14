import { useId } from 'react';
import { config, isPlaceholder } from '../../config';
import { GlitchText } from '../../components/GlitchText';
import { ContractAddress } from './ContractAddress';

interface LinkDef {
  key: string;
  label: string;
  href: string;
  className: string;
}

const LINKS: LinkDef[] = [
  { key: 'buy', label: `BUY ${config.ticker}`, href: config.links.buy, className: 'btn-primary home-links__buy' },
  { key: 'chart', label: 'CHART', href: config.links.chart, className: 'btn-ghost' },
  { key: 'x', label: 'X', href: config.links.x, className: 'btn-ghost' },
];

function HeroLinks() {
  const hintId = useId();
  const anyPending = LINKS.some((l) => isPlaceholder(l.href));
  return (
    <div className="home-links">
      <div className="home-links__grid">
        {LINKS.map((l) =>
          isPlaceholder(l.href) ? (
            // No href at all: an unfinished config must never ship a dead link.
            <a
              key={l.key}
              role="link"
              aria-disabled="true"
              aria-describedby={hintId}
              className={`btn ${l.className} home-links__btn`}
              title="Link pending"
            >
              {l.label}
            </a>
          ) : (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn ${l.className} home-links__btn`}
            >
              {l.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ),
        )}
      </div>
      {anyPending && (
        <p id={hintId} className="home-links__hint">
          <span aria-hidden="true">[!] </span>LINK PENDING: dimmed buttons unlock once the coordinates are declassified.
        </p>
      )}
    </div>
  );
}

export function Hero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero__exhibit">
        <figure className="home-exhibit">
          <span className="home-exhibit__glow" aria-hidden="true" />
          <span className="home-exhibit__corner home-exhibit__corner--tl" aria-hidden="true" />
          <span className="home-exhibit__corner home-exhibit__corner--tr" aria-hidden="true" />
          <span className="home-exhibit__corner home-exhibit__corner--bl" aria-hidden="true" />
          <span className="home-exhibit__corner home-exhibit__corner--br" aria-hidden="true" />
          <span className="home-exhibit__cross" aria-hidden="true" />
          <span className="home-exhibit__label" aria-hidden="true">
            EXHIBIT A
          </span>
          <span className="home-exhibit__rec" aria-hidden="true">
            <span className="rec-dot" /> REC
          </span>
          <img
            className="home-exhibit__hat"
            src="/hats/tinfoil-hat.png"
            width={643}
            height={540}
            alt="A crinkled silver tinfoil hat: a foil dome with a curled tip on top"
            fetchPriority="high"
            decoding="async"
          />
          <figcaption className="sr-only">Exhibit A: the hat.</figcaption>
        </figure>
      </div>

      <div className="home-hero__copy">
        <p className="eyebrow">// FILE 001: CYBER INCIDENT COIN ON {config.chain.toUpperCase()}</p>
        <div id="home-title" className="home-hero__title">
          <GlitchText as="h1" text={config.tokenName} className="home-hero__name heading-crt" />
          <p className="home-hero__ticker">{config.ticker}</p>
        </div>
        <p className="home-hero__tagline">{config.tagline}</p>
        <HeroLinks />
        <ContractAddress />
      </div>
    </section>
  );
}
