import { CATEGORIES, slugify, type Category, type Incident } from '../../../shared/types';

/* ------------------------------------------------------------------ */
/* New-item detection                                                  */
/* ------------------------------------------------------------------ */

/**
 * Split the latest server snapshot (newest first) into what is on screen and
 * what arrived since. `shownIds` is the set of ids the user has accepted
 * (everything from the first load, plus anything inserted via "NEW INTEL").
 *
 * - `shown` keeps the server's order and the server's latest copy of each
 *   item, so displayed cards refresh in place. Items that dropped out of the
 *   server window simply disappear.
 * - `pending` is every server item the user has not accepted yet.
 */
export function splitFeed(
  serverItems: readonly Incident[],
  shownIds: ReadonlySet<string>,
): { shown: Incident[]; pending: Incident[] } {
  const shown: Incident[] = [];
  const pending: Incident[] = [];
  for (const item of serverItems) {
    (shownIds.has(item.id) ? shown : pending).push(item);
  }
  return { shown, pending };
}

/* ------------------------------------------------------------------ */
/* Filters (mirrored in the URL: ?category=a,b&source=x&range=7d&q=..) */
/* ------------------------------------------------------------------ */

export const RANGES = ['24h', '7d', '30d'] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = '7d';

const RANGE_MS: Record<Range, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export interface FeedFilters {
  categories: Category[];
  /** Source slug (slugify(source name)), or '' for all. */
  source: string;
  range: Range;
  q: string;
}

const CATEGORY_BY_SLUG = new Map<string, Category>(CATEGORIES.map((c) => [slugify(c), c]));

export function parseFilters(params: URLSearchParams): FeedFilters {
  const categories: Category[] = [];
  for (const raw of (params.get('category') ?? '').split(',')) {
    const cat = CATEGORY_BY_SLUG.get(slugify(raw));
    if (cat && !categories.includes(cat)) categories.push(cat);
  }
  // Keep the canonical CATEGORIES order so equal selections produce equal URLs.
  categories.sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));

  const rangeParam = params.get('range');
  const range = (RANGES as readonly string[]).includes(rangeParam ?? '') ? (rangeParam as Range) : DEFAULT_RANGE;

  return {
    categories,
    source: slugify(params.get('source') ?? ''),
    range,
    q: params.get('q') ?? '',
  };
}

/** Write filters into a copy of `prev`, leaving unrelated params alone. Defaults are omitted. */
export function writeFilters(prev: URLSearchParams, f: FeedFilters): URLSearchParams {
  const next = new URLSearchParams(prev);
  const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
  set('category', f.categories.map(slugify).join(','));
  set('source', f.source);
  set('range', f.range === DEFAULT_RANGE ? '' : f.range);
  set('q', f.q.trim());
  return next;
}

export function hasActiveFilters(f: FeedFilters): boolean {
  return f.categories.length > 0 || f.source !== '' || f.range !== DEFAULT_RANGE || f.q.trim() !== '';
}

function searchWords(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Build a predicate for the given filters. `ignoreCategory` is used for the
 * per-category chip counts (faceted counts: everything but the category filter).
 */
export function makeMatcher(f: FeedFilters, now: number, ignoreCategory = false): (item: Incident) => boolean {
  const cutoff = now - RANGE_MS[f.range];
  const words = searchWords(f.q);
  const cats = ignoreCategory ? [] : f.categories;
  return (item) => {
    const t = Date.parse(item.publishedAt);
    if (!Number.isNaN(t) && t < cutoff) return false;
    if (f.source && slugify(item.source) !== f.source) return false;
    if (cats.length && !item.categories.some((c) => cats.includes(c))) return false;
    if (words.length) {
      const hay = `${item.title} ${item.snippet} ${item.source}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  };
}

export function countByCategory(items: readonly Incident[], match: (item: Incident) => boolean): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const item of items) {
    if (!match(item)) continue;
    for (const c of item.categories) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* Deterministic per-card decoration                                   */
/* ------------------------------------------------------------------ */

/** Small stable hash of an id string (FNV-1a). */
export function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
