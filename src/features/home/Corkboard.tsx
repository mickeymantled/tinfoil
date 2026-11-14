import { useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Pushpin } from '../../components/Decor';
import { useRedString } from './useRedString';

interface Note {
  exhibit: string;
  title: string;
  copy: string;
  cta: string;
  to: string;
  tilt: number;
  pin: 'red' | 'amber' | 'green';
  variant: 'paper' | 'index' | 'manila';
}

const NOTES: Note[] = [
  {
    exhibit: 'EXHIBIT B',
    title: 'HAT GENERATOR',
    copy: 'Drop in your PFP and we fit the hat. It all happens in your browser. Nothing gets uploaded. Obviously.',
    cta: 'SUIT UP',
    to: '/hat-generator',
    tilt: -2.2,
    pin: 'red',
    variant: 'index',
  },
  {
    exhibit: 'EXHIBIT C',
    title: 'INCIDENT FEED',
    copy: 'Real breaches, ransomware and blackouts from public sources, refreshed every minute. Coincidence? Read the files.',
    cta: 'OPEN THE FILES',
    to: '/incidents',
    tilt: 1.6,
    pin: 'amber',
    variant: 'paper',
  },
  {
    exhibit: 'EXHIBIT D',
    title: 'SURVIVAL GUIDE',
    copy: 'When the grid goes dark, the prepared stay calm. Water, food, power, comms. A real checklist. Leaked.',
    cta: 'GET READY',
    to: '/survival-guide',
    tilt: -1.1,
    pin: 'green',
    variant: 'manila',
  },
];

export function Corkboard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const geom = useRedString(boardRef);

  return (
    <section className="home-section" aria-labelledby="board-title">
      <p className="eyebrow">// FILE 001-C: EVIDENCE BOARD</p>
      <h2 id="board-title" className="heading-crt home-section__title">
        CONNECT THE DOTS
      </h2>
      <p className="home-section__lede">Three real tools. One very obvious pattern.</p>

      <div ref={boardRef} className="cork home-board">
        {geom.paths.length > 0 && (
          <svg
            className="home-board__string"
            width={geom.width}
            height={geom.height}
            viewBox={`0 0 ${geom.width} ${geom.height}`}
            aria-hidden="true"
            focusable="false"
          >
            {geom.paths.map((d, i) => (
              <g key={i}>
                <path d={d} className="home-board__string-shadow" />
                <path d={d} className="home-board__string-line" />
              </g>
            ))}
          </svg>
        )}

        <ul className="home-board__grid">
          {NOTES.map((n) => (
            <li key={n.to} className="home-note-wrap" data-card="">
              <span className="home-note__pin" data-pin="" data-pin-y="0.34" aria-hidden="true">
                <Pushpin color={n.pin} />
              </span>
              <Link
                to={n.to}
                className={`home-note home-note--${n.variant}`}
                style={{ '--tilt': `${n.tilt}deg` } as CSSProperties}
              >
                <span className="home-note__exhibit">{n.exhibit}</span>
                <h3 className="home-note__title">{n.title}</h3>
                <p className="home-note__copy">{n.copy}</p>
                <span className="home-note__cta">
                  {n.cta} <span aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
