/**
 * Types and constants shared by the Express server and the React client.
 * Keep this file free of Node-only and browser-only imports.
 */

export const CATEGORIES = [
  'Ransomware',
  'Data Breach',
  'Infrastructure/Grid',
  'Outage',
  'Vulnerability/Zero-Day',
  'Nation-State',
  'Crypto Hack',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** One normalized incident, as stored on disk and returned by the API. */
export interface Incident {
  /** Stable id: hash of the article URL. */
  id: string;
  /** Headline exactly as the source published it. */
  title: string;
  /** Link to the original article. */
  url: string;
  /** Display name of the source. */
  source: string;
  /** ISO 8601 timestamp. */
  publishedAt: string;
  /** Plain-text excerpt, at most 200 characters. Never the full article. */
  snippet: string;
  categories: Category[];
}

export interface TickerItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  /** Primary category (first of the incident's categories). */
  category: Category;
}

export const THREAT_LEVELS = ['LOW', 'ELEVATED', 'HIGH', 'SEVERE'] as const;
export type ThreatLevelName = (typeof THREAT_LEVELS)[number];

/** Meme metric. Derived only from how many incidents were reported in the last 24 hours. */
export interface Threat {
  level: ThreatLevelName;
  /** 0..3, index into THREAT_LEVELS. */
  index: number;
  /** Incidents published in the last 24 hours. */
  count24h: number;
}

export interface IncidentsResponse {
  items: Incident[];
  /** Number of incidents matching the filters before `limit` was applied. */
  total: number;
  /** Source names that currently have items in the store. */
  sources: string[];
  categories: readonly Category[];
  /** When the server last finished polling its sources (null until the first poll completes). */
  lastPollAt: string | null;
}

export interface TickerResponse {
  items: TickerItem[];
  threat: Threat;
  lastPollAt: string | null;
}

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  /** Result of the most recent attempt. null until the first attempt finishes. */
  ok: boolean | null;
  /** Items parsed from the source on the last successful fetch. */
  itemCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface StatusResponse {
  ok: boolean;
  startedAt: string;
  polling: boolean;
  pollIntervalMs: number;
  lastPollAt: string | null;
  nextPollAt: string | null;
  itemCount: number;
  threat: Threat;
  sources: SourceStatus[];
}

/** "Infrastructure/Grid" -> "infrastructure-grid". Used for URL params and CSS hooks. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
