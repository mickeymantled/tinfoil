import type { Incident } from '../shared/types';

const TITLE_WINDOW_MS = 48 * 60 * 60 * 1000;
const JACCARD_MIN = 0.8;
const MIN_TOKENS = 4;

/** Lowercase, accents and punctuation removed, whitespace collapsed. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface TitleKey {
  norm: string;
  tokens: Set<string>;
  /** Tokens containing digits (CVE ids, advisory ids, versions, amounts), sorted and joined. */
  digits: string;
  time: number;
}

function titleKey(item: Incident): TitleKey {
  const norm = normalizeTitle(item.title);
  const tokens = new Set(norm.split(' ').filter(Boolean));
  const digits = [...tokens].filter((t) => /\d/.test(t)).sort().join(' ');
  return { norm, tokens, digits, time: Date.parse(item.publishedAt) };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function nearDuplicate(a: TitleKey, b: TitleKey): boolean {
  if (!(Math.abs(a.time - b.time) <= TITLE_WINDOW_MS)) return false;
  if (a.digits !== b.digits) return false;
  if (a.norm === b.norm) return a.norm.length > 0;
  if (Math.min(a.tokens.size, b.tokens.size) < MIN_TOKENS) return false;
  return jaccard(a.tokens, b.tokens) >= JACCARD_MIN;
}

export interface MergeOptions {
  /** True for sources whose titles legitimately repeat (title dedupe is skipped between two such items). */
  repeatTitles?: (sourceName: string) => boolean;
}

export interface MergeResult {
  items: Incident[];
  /** Ids of items that were not in `existing` before. */
  addedIds: string[];
}

/**
 * Merges freshly fetched items into the existing list.
 * - Same id (same canonical URL): fresh title/snippet/categories win, the
 *   earliest publishedAt is kept so items do not jump around.
 * - Near-identical title within 48h (and identical digit tokens): the item
 *   already present (existing, or seen earlier in `fresh`) is kept, the new
 *   one is dropped. Skipped when both items come from repeat-title sources.
 * The result is not sorted or trimmed; the store does that.
 */
export function mergeIncidents(existing: Incident[], fresh: Incident[], opts: MergeOptions = {}): MergeResult {
  const repeat = opts.repeatTitles ?? (() => false);
  const byId = new Map<string, Incident>();
  const keys = new Map<string, TitleKey>();
  for (const item of existing) {
    if (byId.has(item.id)) continue;
    byId.set(item.id, item);
    keys.set(item.id, titleKey(item));
  }

  const addedIds: string[] = [];
  for (const item of fresh) {
    const prev = byId.get(item.id);
    if (prev) {
      const publishedAt =
        Date.parse(prev.publishedAt) <= Date.parse(item.publishedAt) ? prev.publishedAt : item.publishedAt;
      const updated: Incident = { ...item, publishedAt };
      byId.set(item.id, updated);
      keys.set(item.id, titleKey(updated));
      continue;
    }

    const key = titleKey(item);
    const itemRepeats = repeat(item.source);
    let dup = false;
    for (const [id, other] of keys) {
      if (itemRepeats && repeat(byId.get(id)!.source)) continue;
      if (nearDuplicate(key, other)) {
        dup = true;
        break;
      }
    }
    if (dup) continue;

    byId.set(item.id, item);
    keys.set(item.id, key);
    addedIds.push(item.id);
  }

  return { items: [...byId.values()], addedIds };
}
