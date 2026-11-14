import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Incident } from '../shared/types';
import { mergeIncidents, normalizeTitle } from './dedupe';
import { hashId } from './text';

function inc(p: Partial<Incident> & { url: string; title: string }): Incident {
  return {
    id: hashId(p.url),
    source: 'BleepingComputer',
    publishedAt: '2026-11-13T12:00:00.000Z',
    snippet: '',
    categories: ['Other'],
    ...p,
  };
}

const repeatTitles = (name: string) => name === 'CISA KEV' || name === 'CISA Advisories';

describe('normalizeTitle', () => {
  it('lowercases and drops punctuation and accents', () => {
    assert.equal(normalizeTitle('  Café’s “Zero-Day” Flaw!  '), 'cafes zero day flaw');
  });
});

describe('mergeIncidents', () => {
  it('dedupes by URL (tracking params, www, trailing slash) and keeps the earliest publishedAt', () => {
    const a = inc({ url: 'https://www.example.com/story/', title: 'Old title', publishedAt: '2026-11-13T10:00:00.000Z' });
    const b = inc({
      url: 'https://example.com/story',
      title: 'New title',
      snippet: 'fresh',
      publishedAt: '2026-11-13T11:00:00.000Z',
      categories: ['Ransomware'],
    });
    assert.equal(a.id, b.id);
    const { items, addedIds } = mergeIncidents([a], [b]);
    assert.equal(items.length, 1);
    assert.deepEqual(addedIds, []);
    assert.equal(items[0].title, 'New title');
    assert.equal(items[0].snippet, 'fresh');
    assert.deepEqual(items[0].categories, ['Ransomware']);
    assert.equal(items[0].publishedAt, '2026-11-13T10:00:00.000Z');
  });

  it('drops near-identical titles from another source within 48h, keeping the existing one', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Trezor confirms crypto-stealing implants in three wallets' });
    const b = inc({
      url: 'https://b.example/2',
      source: 'The Hacker News',
      title: 'Trezor Confirms Crypto-Stealing Implants in Three Wallets',
      publishedAt: '2026-11-14T08:00:00.000Z',
    });
    const { items, addedIds } = mergeIncidents([a], [b]);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, a.id);
    assert.deepEqual(addedIds, []);
  });

  it('uses token Jaccard >= 0.8 for small wording differences', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Microsoft struggles to restore email and other services in global outage' });
    const b = inc({ url: 'https://b.example/2', title: 'Microsoft struggles to restore email and other services in a global outage' });
    assert.equal(mergeIncidents([a], [b]).items.length, 1);
  });

  it('keeps the first of two near-duplicates within the same fresh batch', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Hackers breach City of Osaka email system' });
    const b = inc({ url: 'https://b.example/2', title: 'Hackers Breach City of Osaka Email System!' });
    const { items, addedIds } = mergeIncidents([], [a, b]);
    assert.equal(items.length, 1);
    assert.deepEqual(addedIds, [a.id]);
  });

  it('does not collapse similar titles more than 48h apart', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Weekly ransomware roundup for security teams', publishedAt: '2026-11-01T00:00:00Z' });
    const b = inc({ url: 'https://a.example/2', title: 'Weekly ransomware roundup for security teams', publishedAt: '2026-11-08T00:00:00Z' });
    assert.equal(mergeIncidents([a], [b]).items.length, 2);
  });

  it('does not collapse titles whose digit tokens differ (CVE ids, versions)', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Critical Fortinet flaw CVE-2026-1001 exploited in attacks' });
    const b = inc({ url: 'https://a.example/2', title: 'Critical Fortinet flaw CVE-2026-1002 exploited in attacks' });
    assert.equal(mergeIncidents([a], [b]).items.length, 2);
  });

  it('does not use Jaccard on very short titles', () => {
    const a = inc({ url: 'https://a.example/1', title: 'Patch now' });
    const b = inc({ url: 'https://a.example/2', title: 'Patch now please' });
    assert.equal(mergeIncidents([a], [b]).items.length, 2);
  });

  it('never title-dedupes two items from repeatTitles sources', () => {
    const a = inc({ url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-04', title: 'Siemens RUGGEDCOM APE1808', source: 'CISA Advisories' });
    const b = inc({ url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-05', title: 'Siemens RUGGEDCOM APE1808', source: 'CISA Advisories' });
    const c = inc({
      url: 'https://www.cisa.gov/news-events/alerts/2026/11/13/cisa-adds-two-known-exploited-vulnerabilities-catalog',
      title: 'CISA Adds Two Known Exploited Vulnerabilities to Catalog',
      source: 'CISA Advisories',
    });
    const d = inc({
      url: 'https://www.cisa.gov/news-events/alerts/2026/11/12/cisa-adds-two-known-exploited-vulnerabilities-catalog',
      title: 'CISA Adds Two Known Exploited Vulnerabilities to Catalog',
      source: 'CISA Advisories',
      publishedAt: '2026-11-12T12:00:00.000Z',
    });
    assert.equal(mergeIncidents([a], [b, c, d], { repeatTitles }).items.length, 4);
    // Without the exception they would collapse.
    assert.equal(mergeIncidents([a], [b, c, d]).items.length, 2);
  });

  it('still title-dedupes a news item against a repeatTitles item', () => {
    const a = inc({ url: 'https://www.cisa.gov/x', title: 'CISA Adds Two Known Exploited Vulnerabilities to Catalog', source: 'CISA Advisories' });
    const b = inc({ url: 'https://news.example/y', title: 'CISA adds two Known Exploited Vulnerabilities to catalog', source: 'SecurityWeek' });
    assert.equal(mergeIncidents([a], [b], { repeatTitles }).items.length, 1);
  });
});
