import { Link } from 'react-router-dom';

const TOOLS = [
  { title: 'HAT GENERATOR', line: 'Fit the foil to your PFP', to: '/hat-generator' },
  { title: 'INCIDENT FEED', line: 'Real breaches, sourced', to: '/incidents' },
  { title: 'SURVIVAL GUIDE', line: 'Grid-down checklist', to: '/survival-guide' },
] as const;

/** The three tools as compact terminal tiles, shown in the hero under the contract address. */
export function ToolLinks() {
  return (
    <nav className="home-tools" aria-label="Tools">
      <p className="eyebrow home-tools__label" aria-hidden="true">
        // CONNECT THE DOTS
      </p>
      <ul className="home-tools__list">
        {TOOLS.map((t) => (
          <li key={t.to} className="home-tools__item">
            <Link to={t.to} className="home-tool">
              <span className="home-tool__corner home-tool__corner--tl" aria-hidden="true" />
              <span className="home-tool__corner home-tool__corner--br" aria-hidden="true" />
              <span className="home-tool__text">
                <span className="home-tool__title">{t.title}</span>
                <span className="home-tool__line">{t.line}</span>
              </span>
              <span className="home-tool__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
