/**
 * Incident sources.
 *
 * To add a source: append an entry here. `type: 'rss'` works for any RSS or
 * Atom feed. To remove one: delete its entry. Each source is fetched in its
 * own try/catch with a timeout, so a dead feed never affects the others; check
 * GET /api/status to see how each one is doing.
 *
 * Every source below was verified to return items when this was built.
 */
export interface SourceDef {
  /** Stable, URL-safe id. */
  id: string;
  /** Name shown on the site and credited next to every item. */
  name: string;
  type: 'rss' | 'cisa-kev';
  url: string;
  /** Newest N items to take from this source on each poll. */
  maxItems: number;
  /**
   * Set for sources whose titles legitimately repeat (advisory catalogs name
   * items after products, so two different advisories can share a title).
   * Items from these sources are only de-duplicated by URL, never by title.
   */
  repeatTitles?: boolean;
}

export const SOURCES: SourceDef[] = [
  {
    id: 'cisa-kev',
    name: 'CISA KEV',
    type: 'cisa-kev',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    maxItems: 40,
    repeatTitles: true,
  },
  {
    id: 'cisa-advisories',
    name: 'CISA Advisories',
    type: 'rss',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    maxItems: 40,
    repeatTitles: true,
  },
  {
    id: 'bleepingcomputer',
    name: 'BleepingComputer',
    type: 'rss',
    url: 'https://www.bleepingcomputer.com/feed/',
    maxItems: 50,
  },
  {
    id: 'the-hacker-news',
    name: 'The Hacker News',
    type: 'rss',
    url: 'https://feeds.feedburner.com/TheHackersNews',
    maxItems: 50,
  },
  {
    id: 'krebs-on-security',
    name: 'Krebs on Security',
    type: 'rss',
    url: 'https://krebsonsecurity.com/feed/',
    maxItems: 50,
  },
  {
    id: 'the-record',
    name: 'The Record',
    type: 'rss',
    url: 'https://therecord.media/feed',
    maxItems: 50,
  },
  {
    id: 'securityweek',
    name: 'SecurityWeek',
    type: 'rss',
    url: 'https://www.securityweek.com/feed/',
    maxItems: 50,
  },
];
