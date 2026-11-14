import { rankFor } from '../../data/survival';

const METER_CELLS = 20;

/** Typewriter-style text meter, e.g. [#######-------------]. Decorative only. */
export function textMeter(percent: number, cells = METER_CELLS): string {
  const filled = Math.round((percent / 100) * cells);
  return `[${'#'.repeat(filled)}${'-'.repeat(cells - filled)}]`;
}

interface ScoreProps {
  percent: number;
  count: number;
  total: number;
}

/** The big score block at the top of the manual. */
export function ScoreMeter({ percent, count, total }: ScoreProps) {
  const rank = rankFor(percent);
  return (
    <div className="tm-score">
      <p className="tm-score-label">Preparedness score</p>
      <div className="tm-score-row">
        <p className="tm-score-pct">{percent}%</p>
        <div className="min-w-0">
          <p className="tm-score-rank">
            RANK: <span>{rank.label}</span>
          </p>
          <p className="tm-score-note">{rank.note}</p>
        </div>
      </div>
      <p className="tm-score-meter" aria-hidden="true">
        {textMeter(percent)}
      </p>
      <p className="tm-score-count">
        {count} of {total} checklist items done
      </p>
    </div>
  );
}

/** Slim fixed bar under the nav, shown once the main score scrolls away. */
export function StickyScore({ percent, count, total, visible }: ScoreProps & { visible: boolean }) {
  const rank = rankFor(percent);
  return (
    <div className="tm-sticky no-print" data-visible={visible ? 'true' : 'false'} aria-hidden={!visible}>
      <div className="container-site tm-sticky-inner">
        <span className="tm-sticky-pct">SCORE {percent}%</span>
        <span className="tm-sticky-meter" aria-hidden="true">
          {textMeter(percent, 12)}
        </span>
        <span className="tm-sticky-count">
          {count}/{total}
        </span>
        <span className="tm-sticky-rank">{rank.label}</span>
        <a href="#manual-index" className="tm-sticky-link" tabIndex={visible ? 0 : -1}>
          INDEX
        </a>
      </div>
    </div>
  );
}
