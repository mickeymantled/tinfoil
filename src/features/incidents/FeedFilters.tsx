import { useId, useState } from 'react';
import { CATEGORIES, slugify, type Category } from '../../../shared/types';
import { RANGES, hasActiveFilters, type FeedFilters as Filters, type Range } from './feedLogic';

interface Props {
  filters: Filters;
  /** Live value of the search box (the URL copy is debounced by the page). */
  qInput: string;
  onQInput: (value: string) => void;
  onChange: (next: Filters) => void;
  onClear: () => void;
  sources: string[];
  categoryCounts: Record<Category, number>;
}

const RANGE_LABEL: Record<Range, string> = { '24h': '24H', '7d': '7D', '30d': '30D' };

export function FeedFilters({ filters, qInput, onQInput, onChange, onClear, sources, categoryCounts }: Props) {
  const uid = useId();
  // Collapsible on phones; always open from sm up (see feed.css).
  const [open, setOpen] = useState(false);
  const active = hasActiveFilters({ ...filters, q: qInput });
  const activeCount =
    filters.categories.length + (filters.source ? 1 : 0) + (filters.range !== '7d' ? 1 : 0) + (qInput.trim() ? 1 : 0);

  const toggleCategory = (c: Category) => {
    const set = filters.categories.includes(c) ? filters.categories.filter((x) => x !== c) : [...filters.categories, c];
    set.sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));
    onChange({ ...filters, categories: set });
  };

  // A source slug from a shared link that is not (yet) in the response still gets an option.
  const sourceKnown = !filters.source || sources.some((s) => slugify(s) === filters.source);

  return (
    <section className="feed-filters panel" aria-label="Filters">
      <div className="feed-filters__search">
        <label htmlFor={`${uid}-q`} className="sr-only">
          Search incidents
        </label>
        <input
          id={`${uid}-q`}
          type="search"
          className="input w-full"
          placeholder="SEARCH THE FILES..."
          value={qInput}
          onChange={(e) => onQInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm feed-filters__toggle"
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          onClick={() => setOpen((o) => !o)}
        >
          FILTERS{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div id={`${uid}-panel`} className={`feed-filters__panel${open ? ' is-open' : ''}`}>
        <fieldset className="feed-filters__group">
          <legend className="feed-filters__legend">CATEGORY</legend>
          <div className="feed-filters__chips">
            {CATEGORIES.map((c) => {
              const on = filters.categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`feed-chip tag tag-${slugify(c)}${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleCategory(c)}
                >
                  {c}
                  <span className="feed-chip__count">
                    <span className="sr-only">, </span>
                    {categoryCounts[c]}
                    <span className="sr-only"> files</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="feed-filters__row">
          <div className="feed-filters__group feed-filters__source">
            <label htmlFor={`${uid}-source`} className="feed-filters__legend">
              SOURCE
            </label>
            <select
              id={`${uid}-source`}
              className="select w-full"
              value={filters.source}
              onChange={(e) => onChange({ ...filters, source: e.target.value })}
            >
              <option value="">ALL SOURCES</option>
              {!sourceKnown && <option value={filters.source}>{filters.source}</option>}
              {sources.map((s) => (
                <option key={s} value={slugify(s)}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="feed-filters__group">
            <legend className="feed-filters__legend">TIME RANGE</legend>
            <div className="feed-seg" role="group">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`feed-seg__btn${filters.range === r ? ' is-on' : ''}`}
                  aria-pressed={filters.range === r}
                  onClick={() => onChange({ ...filters, range: r })}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          </fieldset>

          {active && (
            <button type="button" className="btn btn-amber btn-sm feed-filters__clear" onClick={onClear}>
              CLEAR FILTERS
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
