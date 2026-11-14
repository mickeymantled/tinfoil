import fs from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES, type Category, type Incident } from '../shared/types';
import { mergeIncidents, type MergeOptions } from './dedupe';

export const MAX_ITEMS = 500;
const FILE_VERSION = 1;

interface StoreFile {
  version: number;
  savedAt: string;
  items: Incident[];
}

const CATEGORY_SET = new Set<string>(CATEGORIES);

/** Validates one item read from disk; returns null if it is unusable. */
function reviveItem(raw: unknown): Incident | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : null);
  const id = str('id');
  const title = str('title');
  const url = str('url');
  const source = str('source');
  const publishedAt = str('publishedAt');
  if (!id || !title || !url || !source || !publishedAt) return null;
  if (!/^https?:\/\//i.test(url) || Number.isNaN(Date.parse(publishedAt))) return null;
  const categories = Array.isArray(r.categories)
    ? (r.categories.filter((c) => typeof c === 'string' && CATEGORY_SET.has(c)) as Category[])
    : [];
  return {
    id,
    title,
    url,
    source,
    publishedAt,
    snippet: str('snippet') ?? '',
    categories: categories.length ? categories : ['Other'],
  };
}

function byNewest(a: Incident, b: Incident): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
}

export class IncidentStore {
  private items: Incident[] = [];
  readonly file: string;
  /** `savedAt` of the file loaded at startup (the last poll before a restart), if any. */
  loadedSavedAt: string | null = null;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'incidents.json');
  }

  /** All items, newest first. Do not mutate. */
  all(): readonly Incident[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  /** Loads the persisted file. A missing or corrupt file leaves the store empty. */
  async load(): Promise<number> {
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[store] could not read ${this.file}: ${(err as Error).message}`);
      }
      return 0;
    }
    try {
      const parsed = JSON.parse(text) as Partial<StoreFile>;
      const raw = Array.isArray(parsed?.items) ? parsed.items : [];
      const seen = new Set<string>();
      const items: Incident[] = [];
      for (const r of raw) {
        const item = reviveItem(r);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
      this.items = items.sort(byNewest).slice(0, MAX_ITEMS);
      if (typeof parsed.savedAt === 'string' && !Number.isNaN(Date.parse(parsed.savedAt))) {
        this.loadedSavedAt = parsed.savedAt;
      }
      return this.items.length;
    } catch (err) {
      console.warn(`[store] ignoring corrupt ${this.file}: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Merges fresh items (dedupe by URL and near-identical title), sorts newest
   * first and keeps the most recent MAX_ITEMS. Returns how many new items
   * made it into the store and whether anything changed.
   */
  merge(fresh: Incident[], opts: MergeOptions = {}): { added: number; changed: boolean } {
    const before = JSON.stringify(this.items);
    const { items, addedIds } = mergeIncidents(this.items, fresh, opts);
    this.items = items.sort(byNewest).slice(0, MAX_ITEMS);
    const kept = new Set(this.items.map((i) => i.id));
    const added = addedIds.filter((id) => kept.has(id)).length;
    return { added, changed: before !== JSON.stringify(this.items) };
  }

  /** Atomic write: temp file in the same directory, then rename. */
  async save(): Promise<void> {
    const dir = path.dirname(this.file);
    await fs.mkdir(dir, { recursive: true });
    const body: StoreFile = { version: FILE_VERSION, savedAt: new Date().toISOString(), items: this.items };
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      await fs.writeFile(tmp, `${JSON.stringify(body, null, 1)}\n`, 'utf8');
      await fs.rename(tmp, this.file);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }
}

export interface IncidentQuery {
  categories?: Category[];
  /** Source names (exact). */
  sources?: string[];
  sinceMs?: number;
  /** Lowercased words; all must appear in title + snippet + source. */
  words?: string[];
  limit: number;
}

export function queryIncidents(
  items: readonly Incident[],
  q: IncidentQuery,
): { items: Incident[]; total: number } {
  const cats = q.categories?.length ? new Set(q.categories) : null;
  const srcs = q.sources ? new Set(q.sources) : null;
  const words = q.words?.filter(Boolean) ?? [];
  const matches = items.filter((it) => {
    if (cats && !it.categories.some((c) => cats.has(c))) return false;
    if (srcs && !srcs.has(it.source)) return false;
    if (q.sinceMs !== undefined && !(Date.parse(it.publishedAt) >= q.sinceMs)) return false;
    if (words.length) {
      const hay = `${it.title} ${it.snippet} ${it.source}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  return { items: matches.slice(0, q.limit), total: matches.length };
}
