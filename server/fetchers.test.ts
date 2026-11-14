import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Incident } from '../shared/types';
import { fetchKev, fetchRss, normalizeKev, type FetchContext, type FetchResult } from './fetchers';
import { Poller } from './poller';
import type { SourceDef } from './sources';
import { IncidentStore } from './store';

const NOW = Date.parse('2026-11-14T00:00:00Z');

const CISA: SourceDef = {
  id: 'cisa-advisories',
  name: 'CISA Advisories',
  type: 'rss',
  url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
  maxItems: 40,
  repeatTitles: true,
};
const KEV: SourceDef = {
  id: 'cisa-kev',
  name: 'CISA KEV',
  type: 'cisa-kev',
  url: 'https://www.cisa.gov/kev.json',
  maxItems: 2,
  repeatTitles: true,
};

const CISA_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xml:base="https://www.cisa.gov/"><channel><title>All CISA Advisories</title>
<item>
  <title>Siemens RUGGEDCOM APE1808</title>
  <link>https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-05</link>
  <description>&lt;div&gt;&lt;a href=&quot;/csaf.json&quot;&gt;View CSAF&lt;/a&gt;&lt;/div&gt;&lt;h2&gt;Summary&lt;/h2&gt;&lt;p&gt;Palo Alto Networks has published information on vulnerabilities in PAN-OS related to &lt;strong&gt;PHP2Shell&lt;/strong&gt; vulnerabilities.&lt;/p&gt;</description>
  <pubDate>Thu, 12 Nov 26 12:00:00 +0000</pubDate>
</item>
<item>
  <title>Siemens RUGGEDCOM APE1808</title>
  <link>https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-04</link>
  <description>&lt;p&gt;View CSAF&lt;/p&gt;&lt;p&gt;Summary&lt;/p&gt;&lt;p&gt;Palo Alto Networks has published information on a vulnerability in PAN-OS related to the Node2Shell vulnerability.&lt;/p&gt;</description>
  <pubDate>Thu, 12 Nov 26 12:00:00 +0000</pubDate>
</item>
<item>
  <title>Future dated item</title>
  <link>https://www.cisa.gov/news-events/alerts/2027/01/01/future</link>
  <description>Overview CISA released guidance.</description>
  <pubDate>Fri, 01 Jan 27 12:00:00 +0000</pubDate>
</item>
<item>
  <title>No date item</title>
  <link>https://www.cisa.gov/news-events/alerts/nodate</link>
</item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
<item><title></title><link>https://www.cisa.gov/untitled</link></item>
</channel></rss>`;

function ctxWith(body: string, init: ResponseInit = {}, seen: Headers[] = []): FetchContext {
  return {
    timeoutMs: 5000,
    userAgent: 'test-agent',
    now: NOW,
    fetchImpl: (async (_url: string | URL | Request, req?: RequestInit) => {
      seen.push(new Headers(req?.headers));
      return new Response(init.status === 304 ? null : body, init);
    }) as typeof fetch,
  };
}

describe('fetchRss (CISA advisories)', () => {
  it('parses 2-digit years, strips boilerplate, adds ICS hints, clamps future dates, skips bad items', async () => {
    const res = await fetchRss(CISA, ctxWith(CISA_XML));
    assert.equal(res.notModified, false);
    if (res.notModified) return;
    const items = res.items;
    assert.equal(items.length, 4);

    const [a, b, future, nodate] = items;
    assert.equal(a.publishedAt, '2026-11-12T12:00:00.000Z');
    assert.equal(a.title, 'Siemens RUGGEDCOM APE1808');
    assert.equal(b.title, a.title);
    assert.notEqual(a.id, b.id);
    assert.match(a.snippet, /^Palo Alto Networks has published/);
    assert.match(b.snippet, /^Palo Alto Networks has published/);
    assert.ok(!/<|&lt;|View CSAF/.test(a.snippet));
    assert.ok(a.snippet.length <= 200);
    assert.ok(a.categories.includes('Infrastructure/Grid'));
    assert.ok(a.categories.includes('Vulnerability/Zero-Day'));
    assert.equal(a.source, 'CISA Advisories');

    assert.equal(future.publishedAt, new Date(NOW).toISOString());
    assert.equal(future.snippet, 'CISA released guidance.');
    assert.ok(!future.categories.includes('Infrastructure/Grid'));
    assert.equal(nodate.publishedAt, new Date(NOW).toISOString());
  });

  it('sends the UA and conditional headers and treats 304 as not modified', async () => {
    const seen: Headers[] = [];
    const ctx = ctxWith('', { status: 304, headers: { etag: '"v2"' } }, seen);
    ctx.validators = { etag: '"v1"', lastModified: 'Fri, 13 Nov 2026 12:00:00 GMT' };
    const res = await fetchRss(CISA, ctx);
    assert.equal(res.notModified, true);
    assert.equal(res.validators.etag, '"v2"');
    assert.equal(seen[0].get('user-agent'), 'test-agent');
    assert.equal(seen[0].get('if-none-match'), '"v1"');
    assert.equal(seen[0].get('if-modified-since'), 'Fri, 13 Nov 2026 12:00:00 GMT');
    assert.match(seen[0].get('accept') ?? '', /application\/rss\+xml/);
  });

  it('throws on HTTP errors', async () => {
    await assert.rejects(fetchRss(CISA, ctxWith('nope', { status: 503 })), /HTTP 503/);
  });
});

describe('normalizeKev', () => {
  const data = {
    vulnerabilities: [
      { cveID: 'CVE-2026-1', vulnerabilityName: 'Old Thing Vulnerability', dateAdded: '2026-10-01', shortDescription: 'old', knownRansomwareCampaignUse: 'Unknown' },
      {
        cveID: 'CVE-2026-114713',
        vulnerabilityName: 'UnrealIRCd Improper Neutralization of Delimiters Vulnerability',
        dateAdded: '2026-11-13',
        shortDescription: 'UnrealIRCd contains an improper neutralization of delimiters vulnerability.',
        knownRansomwareCampaignUse: 'Unknown',
      },
      {
        cveID: 'CVE-2026-20320',
        vulnerabilityName: 'Cisco BroadWorks XXE Vulnerability',
        dateAdded: '2026-11-10',
        shortDescription: 'Cisco BroadWorks contains an XXE vulnerability.',
        knownRansomwareCampaignUse: 'Known',
      },
      { cveID: 'not-a-cve', dateAdded: '2026-11-13' },
    ],
  };

  it('takes the newest maxItems and maps fields', () => {
    const items = normalizeKev(KEV, data, NOW);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'CVE-2026-114713: UnrealIRCd Improper Neutralization of Delimiters Vulnerability');
    assert.equal(
      items[0].url,
      'https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=CVE-2026-114713',
    );
    assert.equal(items[0].publishedAt, '2026-11-13T00:00:00.000Z');
    assert.equal(items[0].categories[0], 'Vulnerability/Zero-Day');
    assert.ok(!items[0].categories.includes('Ransomware'));
    assert.deepEqual(items[1].categories.slice(0, 2), ['Vulnerability/Zero-Day', 'Ransomware']);
    assert.equal(items[1].source, 'CISA KEV');
  });

  it('fetchKev rejects a malformed catalog', async () => {
    await assert.rejects(fetchKev(KEV, ctxWith('{"nope":1}')), /vulnerabilities/);
  });
});

describe('Poller', () => {
  const mk = (id: string, n: number): Incident => ({
    id: `${id}-${n}`,
    title: `${id} headline number ${n} with enough words`,
    url: `https://${id}.example/${n}`,
    source: id,
    publishedAt: new Date(NOW - n * 60_000).toISOString(),
    snippet: '',
    categories: ['Other'],
  });
  const sources: SourceDef[] = ['good', 'bad', 'cached'].map((id) => ({ id, name: id, type: 'rss', url: `https://${id}.example/feed`, maxItems: 10 }));

  it('isolates failing sources, keeps 304 item counts, never overlaps polls', async () => {
    let calls = 0;
    const fake = async (s: SourceDef, ctx: FetchContext): Promise<FetchResult> => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      if (s.id === 'bad') throw new Error('boom');
      if (s.id === 'cached' && ctx.validators?.etag) return { notModified: true, validators: ctx.validators };
      return { notModified: false, items: [mk(s.id, 1), mk(s.id, 2)], validators: { etag: '"e"' } };
    };
    const store = new IncidentStore('/nonexistent-dir-for-test');
    store.save = async () => {};
    const lines: string[] = [];
    const poller = new Poller({ sources, store, intervalMs: 60_000, timeoutMs: 1000, userAgent: 'x', fetchSource: fake, log: (l) => lines.push(l) });

    const [s1, s2] = await Promise.all([poller.pollOnce(), poller.pollOnce()]);
    assert.equal(s1, s2);
    assert.equal(calls, 3);
    assert.equal(s1.ok, 2);
    assert.equal(s1.failed, 1);
    assert.equal(s1.added, 4);
    assert.equal(store.size, 4);
    assert.ok(poller.lastPollAt);

    const second = await poller.pollOnce();
    assert.equal(second.added, 0);
    const st = Object.fromEntries(poller.sourceStatuses().map((s) => [s.id, s]));
    assert.equal(st.bad.ok, false);
    assert.equal(st.bad.error, 'boom');
    assert.equal(st.cached.ok, true);
    assert.equal(st.cached.itemCount, 2);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /2\/3 sources ok, 1 failed \| \+4 new, 4 total/);
    assert.match(lines[1], /cached=2\(304\)/);
  });
});
