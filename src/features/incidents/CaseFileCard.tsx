import type { CSSProperties } from 'react';
import type { Incident } from '../../../shared/types';
import { CategoryTag } from '../../components/CategoryTag';
import { CoffeeStain, PaperClip } from '../../components/Decor';
import { formatDateTime, timeAgo } from '../../lib/time';
import { idHash } from './feedLogic';

interface Props {
  incident: Incident;
  now: number;
  fresh?: boolean;
  headingLevel?: 'h2' | 'h3';
}

export function CaseFileCard({ incident, now, fresh = false, headingLevel = 'h3' }: Props) {
  const h = idHash(incident.id);
  // -0.9deg .. +0.9deg, deterministic per incident
  const tilt = ((h % 19) - 9) / 10;
  const clip = h % 5 === 0;
  const stain = !clip && h % 7 === 3;
  const caseNo = incident.id.slice(0, 6).toUpperCase();
  const Heading = headingLevel;

  return (
    <article
      className={`case-file folder${fresh ? ' case-file--fresh' : ''}`}
      style={{ '--tilt': `${tilt}deg` } as CSSProperties}
      aria-labelledby={`case-${incident.id}`}
    >
      <div className="folder-tab case-file__tab">CASE #{caseNo}</div>
      {clip && <PaperClip className="case-file__clip" />}

      <div className="paper case-file__paper">
        {stain && <CoffeeStain className="case-file__stain" />}
        {fresh && (
          <span className="case-file__new" aria-label="Newly added">
            NEW
          </span>
        )}

        <p className="case-file__meta">
          <span className="case-file__source">{incident.source}</span>
          <span aria-hidden="true"> / </span>
          <time dateTime={incident.publishedAt}>
            {formatDateTime(incident.publishedAt)}
          </time>
          <span className="case-file__ago"> ({timeAgo(incident.publishedAt, now)})</span>
        </p>

        <Heading id={`case-${incident.id}`} className="case-file__title">
          <a href={incident.url} target="_blank" rel="noopener noreferrer">
            {incident.title}
          </a>
        </Heading>

        {incident.categories.length > 0 && (
          <ul className="case-file__tags" aria-label="Categories">
            {incident.categories.map((c) => (
              <li key={c}>
                <CategoryTag category={c} />
              </li>
            ))}
          </ul>
        )}

        {incident.snippet && <p className="case-file__snippet">{incident.snippet}</p>}

        <a className="btn btn-paper btn-sm case-file__open" href={incident.url} target="_blank" rel="noopener noreferrer">
          OPEN SOURCE FILE<span className="sr-only"> at {incident.source} (opens in a new tab)</span>
          <span aria-hidden="true"> &#8599;</span>
        </a>
      </div>
    </article>
  );
}
