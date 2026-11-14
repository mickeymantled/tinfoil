import crypto from 'node:crypto';
import { decodeHTML } from 'entities';

export const SNIPPET_MAX = 200;

function collapseWhitespace(s: string): string {
  return s.replace(/[\u00a0\u200b-\u200d\u2028\u2029\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Removes all markup and returns plain text. Used for snippets only. */
export function stripHtml(input: string): string {
  let s = input ?? '';
  // Two passes: some feeds double-escape their HTML, so tags only appear
  // after the first round of entity decoding.
  for (let pass = 0; pass < 2; pass++) {
    s = s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|iframe|svg|head|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
    s = decodeHTML(s);
  }
  return collapseWhitespace(s)
    .replace(/\s+([,.;:!?%)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1');
}

/**
 * Cleans a headline without rewording it: decodes entities, drops inline
 * formatting tags and collapses whitespace. Nothing else is changed.
 */
export function cleanTitle(input: string): string {
  let s = (input ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = s.replace(/<\/?(em|i|b|strong|span|cite|u|sup|sub|br)\b[^>]*>/gi, ' ');
  if (/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(s)) s = decodeHTML(s);
  return collapseWhitespace(s);
}

/** Trims to at most `max` characters on a word boundary, adding an ellipsis. */
export function truncate(text: string, max = SNIPPET_MAX): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[\s,;:.\-–—([]+$/, '');
  return `${cut}…`;
}

/** Plain-text excerpt for an item: markup stripped, feed boilerplate removed, max 200 chars. */
export function makeSnippet(
  raw: string | undefined | null,
  opts: { dropLeading?: RegExp } = {},
): string {
  if (!raw) return '';
  let s = stripHtml(raw);
  // Source-specific navigation/boilerplate at the very start (anchored regex).
  if (opts.dropLeading) s = s.replace(opts.dropLeading, '').trim();
  // WordPress feed footer: "The post <title> appeared first on <site>."
  s = s.replace(/\s*The post .{0,300}?(appeared first on|first appeared on) .*$/i, '');
  // Trailing "[...]" / "[…]" / "Read more" markers
  s = s.replace(/\s*(\[\s*(…|\.\.\.)\s*\]|\(?(read|continue reading|view) more\b.*)$/i, '…');
  s = s.replace(/…+$/, '…').replace(/[.\s]*…$/, '…').trim();
  if (s === '…') return '';
  return truncate(s, SNIPPET_MAX);
}

const TRACKING_PARAMS = /^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid|igshid|ref_src)$/i;

/**
 * Returns a safe, tidy http(s) URL for linking, or null if the input is not
 * one. Tracking parameters and fragments are removed.
 */
export function cleanUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

/** Canonical form of a URL used only for duplicate detection. */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
    return `${host}${pathname}${query}`;
  } catch {
    return url;
  }
}

/** Incident id: a short hash of the article URL. */
export function hashId(url: string): string {
  return crypto.createHash('sha1').update(urlKey(url)).digest('hex').slice(0, 16);
}

/**
 * Parses feed dates. Handles ISO 8601, RFC 822, and the RFC 822 two-digit
 * year form some feeds still emit ("Fri, 13 Nov 26 12:00:00 +0000").
 */
export function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw
    .trim()
    .replace(
      /^((?:[A-Za-z]{3},\s*)?\d{1,2}\s+[A-Za-z]{3,9}\s+)(\d{2})(\s+\d{1,2}:)/,
      (_m, head: string, yy: string, tail: string) => `${head}${Number(yy) < 70 ? 2000 + Number(yy) : 1900 + Number(yy)}${tail}`,
    );
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
