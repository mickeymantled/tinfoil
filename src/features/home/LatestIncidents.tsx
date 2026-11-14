import { Link } from 'react-router-dom';
import { CategoryTag } from '../../components/CategoryTag';
import { StatePanel } from '../../components/StatePanel';
import { timeAgo, useNow } from '../../lib/time';
import { useTicker } from '../../lib/ticker';

export function LatestIncidents() {
  const { items, status, refresh } = useTicker();
  const now = useNow(30_000);
  const latest = items.slice(0, 5);

  let body;
  if (status === 'loading') {
    body = (
      <StatePanel kind="loading" title="INTERCEPTING TRANSMISSIONS" compact>
        Pulling the newest reports from public sources.
      </StatePanel>
    );
  } else if (status === 'error') {
    body = (
      <StatePanel
        kind="error"
        title="SIGNAL LOST"
        compact
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
            RETRY
          </button>
        }
      >
        Could not reach the incident archive. Trying again shortly.
      </StatePanel>
    );
  } else if (latest.length === 0) {
    body = (
      <StatePanel kind="empty" title="ALL QUIET" compact>
        No incidents on file right now. Suspicious, honestly.
      </StatePanel>
    );
  } else {
    body = (
      <ol className="home-latest__list">
        {latest.map((item) => (
          <li key={item.id} className="home-latest__row">
            <div className="home-latest__meta">
              <time dateTime={item.publishedAt} className="home-latest__time">
                {timeAgo(item.publishedAt, now)}
              </time>
              <CategoryTag category={item.category} />
            </div>
            <div className="home-latest__main">
              <a className="home-latest__title" href={item.url} target="_blank" rel="noopener noreferrer">
                {item.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="home-latest__source">{item.source}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section className="home-section" aria-labelledby="latest-title">
      <p className="eyebrow">// FILE 001-D: LIVE INTERCEPTS</p>
      <div className="panel home-latest">
        <div className="home-latest__head">
          <h2 id="latest-title" className="heading-crt home-latest__heading">
            <span className="rec-dot" aria-hidden="true" /> LATEST INCIDENTS
          </h2>
          <p className="home-latest__note">Real reports. Original headlines. Linked to the source.</p>
        </div>
        {body}
        <div className="home-latest__foot">
          <Link to="/incidents" className="btn btn-amber">
            VIEW ALL CASE FILES <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
