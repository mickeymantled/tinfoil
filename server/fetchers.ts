import Parser from 'rss-parser';
import type { Category, Incident } from '../shared/types';
import { categorize } from './categorize';
import type { SourceDef } from './sources';
import { cleanTitle, cleanUrl, hashId, makeSnippet, parseDate } from './text';

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; IncidentFeedReader/1.0)';
const ACCEPT =
  'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8';

/** Conditional-request validators remembered per source between polls. */
export interface CacheValidators {
  etag?: string;
  lastModified?: string;
}

export type FetchResult =
  | { notModified: true; validators: CacheValidators }
  | { notModified: false; items: Incident[]; validators: CacheValidators };

export interface FetchContext {
  timeoutMs: number;
  userAgent: string;
  validators?: CacheValidators;
  /** Injected for tests. */
  now?: number;
  fetchImpl?: typeof fetch;
}

async function fetchText(
  url: string,
  ctx: FetchContext,
): Promise<{ notModified: true; validators: CacheValidators } | { notModified: false; body: string; validators: CacheValidators }> {
  const headers: Record<string, string> = { 'User-Agent': ctx.userAgent, Accept: ACCEPT };
  if (ctx.validators?.etag) headers['If-None-Match'] = ctx.validators.etag;
  if (ctx.validators?.lastModified) headers['If-Modified-Since'] = ctx.validators.lastModified;

  const res = await (ctx.fetchImpl ?? fetch)(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(ctx.timeoutMs),
  });
  const validators: CacheValidators = {
    etag: res.headers.get('etag') ?? ctx.validators?.etag,
    lastModified: res.headers.get('last-modified') ?? ctx.validators?.lastModified,
  };
  if (res.status === 304) {
    await res.body?.cancel().catch(() => {});
    return { notModified: true, validators };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
  }
  return { notModified: false, body: await res.text(), validators };
}

/** Clamps to "now" when a feed claims a future date; falls back to first-seen time. */
function publishedAt(raw: unknown, now: number): string {
  const d = parseDate(raw);
  const t = d ? Math.min(d.getTime(), now) : now;
  return new Date(t).toISOString();
}

/**
 * CISA advisory descriptions are whole advisories; after stripping, ICS ones
 * start with page chrome such as "View CSAF Summary" and resources start with
 * "Overview". Drop those so the snippet starts with real summary text.
 */
const CISA_LEADING_BOILERPLATE =
  /^(?:(?:View CSAF|View CSAF Summary|Summary|Overview|Executive Summary|1\.\s*EXECUTIVE SUMMARY|Introduction|Background)\b[\s:.\-]*)+/i;

function rssHints(source: SourceDef, link: string): Category[] {
  if (source.id === 'cisa-advisories' && /\/ics(-medical)?-advisories\//i.test(link)) {
    return ['Infrastructure/Grid', 'Vulnerability/Zero-Day'];
  }
  return [];
}

interface RssItemLike {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
}

/** Normalizes a parsed RSS/Atom feed. Exported for tests. */
export function normalizeRssItems(source: SourceDef, rawItems: RssItemLike[], now = Date.now()): Incident[] {
  const out: Incident[] = [];
  const dropLeading = source.id.startsWith('cisa') ? CISA_LEADING_BOILERPLATE : undefined;
  for (const it of rawItems) {
    if (out.length >= source.maxItems) break;
    const title = cleanTitle(it.title ?? '');
    const guidUrl = it.guid && /^https?:\/\//i.test(it.guid) ? it.guid : undefined;
    const url = cleanUrl(it.link) ?? cleanUrl(guidUrl);
    if (!title || !url) continue;
    // Short description only. Never content:encoded (full article text).
    const snippet = makeSnippet(it.summary ?? it.content ?? it.contentSnippet, { dropLeading });
    out.push({
      id: hashId(url),
      title,
      url,
      source: source.name,
      publishedAt: publishedAt(it.pubDate ?? it.isoDate, now),
      snippet,
      categories: categorize(title, snippet, { hints: rssHints(source, url) }),
    });
  }
  return out;
}

export async function fetchRss(source: SourceDef, ctx: FetchContext): Promise<FetchResult> {
  const res = await fetchText(source.url, ctx);
  if (res.notModified) return res;
  const feed = await new Parser().parseString(res.body);
  const items = normalizeRssItems(source, (feed.items ?? []) as RssItemLike[], ctx.now ?? Date.now());
  if (items.length === 0) throw new Error('feed parsed but contained no usable items');
  return { notModified: false, items, validators: res.validators };
}

interface KevEntry {
  cveID?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  knownRansomwareCampaignUse?: string;
}

/** Normalizes the CISA KEV catalog: newest `maxItems` by dateAdded. Exported for tests. */
export function normalizeKev(source: SourceDef, data: unknown, now = Date.now()): Incident[] {
  const vulns = (data as { vulnerabilities?: unknown })?.vulnerabilities;
  if (!Array.isArray(vulns)) throw new Error('KEV JSON has no vulnerabilities array');
  const entries = (vulns as KevEntry[])
    .filter((v) => v && typeof v.cveID === 'string' && /^CVE-\d{4}-\d{4,}$/i.test(v.cveID.trim()))
    .map((v) => ({ v, t: Date.parse(`${v.dateAdded ?? ''}T00:00:00Z`) }))
    .filter((e) => !Number.isNaN(e.t))
    // Newest first; within a day, higher CVE number first (stable, deterministic).
    .sort((a, b) => b.t - a.t || (b.v.cveID ?? '').localeCompare(a.v.cveID ?? '', 'en', { numeric: true }))
    .slice(0, source.maxItems);

  return entries.map(({ v, t }) => {
    const cve = v.cveID!.trim().toUpperCase();
    const title = cleanTitle(`${cve}: ${v.vulnerabilityName ?? 'Known Exploited Vulnerability'}`);
    const url = `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(cve)}`;
    const snippet = makeSnippet(v.shortDescription);
    const hints: Category[] = ['Vulnerability/Zero-Day'];
    if (v.knownRansomwareCampaignUse === 'Known') hints.push('Ransomware');
    const found = categorize(title, snippet).filter((c) => c !== 'Other');
    const categories = [...new Set<Category>([...hints, ...found])];
    return {
      id: hashId(url),
      title,
      url,
      source: source.name,
      publishedAt: new Date(Math.min(t, now)).toISOString(),
      snippet,
      categories,
    };
  });
}

export async function fetchKev(source: SourceDef, ctx: FetchContext): Promise<FetchResult> {
  const res = await fetchText(source.url, ctx);
  if (res.notModified) return res;
  const items = normalizeKev(source, JSON.parse(res.body), ctx.now ?? Date.now());
  if (items.length === 0) throw new Error('KEV catalog contained no usable entries');
  return { notModified: false, items, validators: res.validators };
}

export function fetchSource(source: SourceDef, ctx: FetchContext): Promise<FetchResult> {
  return source.type === 'cisa-kev' ? fetchKev(source, ctx) : fetchRss(source, ctx);
}
