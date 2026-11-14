import { useId } from 'react';
import { Link } from 'react-router-dom';

interface Exhibit {
  exhibit: string;
  title: string;
  copy: string;
  status: string;
  cta: string;
  to: string;
}

// Status lines are static facts about each tool, never live numbers.
const EXHIBITS: Exhibit[] = [
  {
    exhibit: 'EXHIBIT B',
    title: 'HAT GENERATOR',
    copy: 'Drop in your PFP and we fit the hat. Nothing gets uploaded, which is exactly what they would not do.',
    status: 'RUNS IN YOUR BROWSER',
    cta: 'SUIT UP',
    to: '/hat-generator',
  },
  {
    exhibit: 'EXHIBIT C',
    title: 'INCIDENT FEED',
    copy: 'Real breaches, ransomware and blackouts from public security reporting, linked to the source. Coincidence? Read the files.',
    status: 'REFRESHES EVERY 60S',
    cta: 'OPEN THE FILES',
    to: '/incidents',
  },
  {
    exhibit: 'EXHIBIT D',
    title: 'SURVIVAL GUIDE',
    copy: 'When the grid goes dark, the prepared stay calm. Water, food, power, comms. Based on public preparedness guidance.',
    status: 'CHECKLISTS SAVE ON THIS DEVICE',
    cta: 'GET READY',
    to: '/survival-guide',
  },
];

function ExhibitPanel({ e }: { e: Exhibit }) {
  const id = useId();
  return (
    <li className="home-intel-item">
      <span className="home-intel__node" aria-hidden="true" />
      <Link
        to={e.to}
        className="home-intel"
        aria-labelledby={`${id}-t ${id}-c`}
        aria-describedby={`${id}-d`}
      >
        <span className="home-intel__corner home-intel__corner--tl" aria-hidden="true" />
        <span className="home-intel__corner home-intel__corner--tr" aria-hidden="true" />
        <span className="home-intel__corner home-intel__corner--bl" aria-hidden="true" />
        <span className="home-intel__corner home-intel__corner--br" aria-hidden="true" />

        <span className="eyebrow">// {e.exhibit}</span>
        <h3 id={`${id}-t`} className="heading-crt home-intel__title">
          {e.title}
        </h3>
        <p id={`${id}-d`} className="home-intel__copy">
          {e.copy}
        </p>
        <p className="home-intel__status">
          <span aria-hidden="true">&gt; </span>
          {e.status}
        </p>
        <span id={`${id}-c`} className="btn btn-ghost btn-sm home-intel__cta">
          {e.cta} <span aria-hidden="true">&rarr;</span>
        </span>
      </Link>
    </li>
  );
}

export function FeatureExhibits() {
  return (
    <section className="home-section" aria-labelledby="board-title">
      <p className="eyebrow">// FILE 001-C: EVIDENCE BOARD</p>
      <h2 id="board-title" className="heading-crt home-section__title">
        CONNECT THE DOTS
      </h2>
      <p className="home-section__lede">Three real tools. One very obvious pattern.</p>

      <ul className="home-intel-grid">
        {EXHIBITS.map((e) => (
          <ExhibitPanel key={e.to} e={e} />
        ))}
      </ul>
    </section>
  );
}
