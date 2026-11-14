import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { Incident } from '../shared/types';
import { IncidentStore, MAX_ITEMS, queryIncidents } from './store';
import { hashId } from './text';

function inc(n: number, p: Partial<Incident> = {}): Incident {
  const url = `https://news.example/${n}`;
  return {
    id: hashId(url),
    title: `Unique headline number ${n} about item ${n * 7}`,
    url,
    source: 'SecurityWeek',
    publishedAt: new Date(Date.UTC(2026, 10, 13, 0, 0, 0) - n * 60_000).toISOString(),
    snippet: '',
    categories: ['Other'],
    ...p,
  };
}

async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'tinfoil-store-'));
}

describe('IncidentStore', () => {
  it('starts empty when the file is missing', async () => {
    const store = new IncidentStore(path.join(await tmpDir(), 'nope'));
    assert.equal(await store.load(), 0);
    assert.equal(store.size, 0);
  });

  it('tolerates a corrupt file', async () => {
    const dir = await tmpDir();
    await fs.writeFile(path.join(dir, 'incidents.json'), '{"version":1,"items":[{"id":', 'utf8');
    const store = new IncidentStore(dir);
    assert.equal(await store.load(), 0);
  });

  it('sorts newest first, caps at MAX_ITEMS, saves atomically and reloads', async () => {
    const dir = await tmpDir();
    const store = new IncidentStore(dir);
    const fresh = Array.from({ length: MAX_ITEMS + 20 }, (_, i) => inc(i));
    const { added, changed } = store.merge([...fresh].reverse());
    assert.equal(added, MAX_ITEMS);
    assert.ok(changed);
    assert.equal(store.size, MAX_ITEMS);
    assert.equal(store.all()[0].id, fresh[0].id);
    await store.save();

    const files = await fs.readdir(dir);
    assert.deepEqual(files, ['incidents.json']);
    const json = JSON.parse(await fs.readFile(path.join(dir, 'incidents.json'), 'utf8'));
    assert.equal(json.version, 1);
    assert.ok(typeof json.savedAt === 'string');
    assert.equal(json.items.length, MAX_ITEMS);

    const again = new IncidentStore(dir);
    assert.equal(await again.load(), MAX_ITEMS);
    assert.deepEqual(again.all(), store.all());
    assert.equal(again.loadedSavedAt, json.savedAt);
  });

  it('drops invalid items on load', async () => {
    const dir = await tmpDir();
    const good = inc(1);
    const items = [good, { ...inc(2), url: 'javascript:alert(1)' }, { id: 'x' }, { ...inc(3), categories: ['Bogus'] }];
    await fs.writeFile(path.join(dir, 'incidents.json'), JSON.stringify({ version: 1, savedAt: 'x', items }), 'utf8');
    const store = new IncidentStore(dir);
    assert.equal(await store.load(), 2);
    assert.deepEqual(store.all().find((i) => i.id === inc(3).id)?.categories, ['Other']);
    assert.equal(store.loadedSavedAt, null);
  });

  it('reports no change when merging the same items again', () => {
    const store = new IncidentStore('/nonexistent');
    store.merge([inc(1), inc(2)]);
    assert.deepEqual(store.merge([inc(1), inc(2)]), { added: 0, changed: false });
  });
});

describe('queryIncidents', () => {
  const items = [
    inc(1, { categories: ['Ransomware', 'Data Breach'], source: 'BleepingComputer', title: 'Qilin ransomware hits hospital' }),
    inc(2, { categories: ['Crypto Hack'], source: 'The Hacker News', title: 'Wallet drainer kit sold online', snippet: 'Solana users targeted' }),
    inc(3, { categories: ['Other'], source: 'The Record', title: 'Policy news', publishedAt: '2026-01-01T00:00:00.000Z' }),
  ];

  it('filters by category (OR), source, since, words, and applies limit after total', () => {
    assert.equal(queryIncidents(items, { categories: ['Ransomware', 'Crypto Hack'], limit: 100 }).total, 2);
    assert.equal(queryIncidents(items, { sources: ['The Record'], limit: 100 }).items[0].id, items[2].id);
    assert.equal(queryIncidents(items, { sinceMs: Date.parse('2026-11-01'), limit: 100 }).total, 2);
    assert.equal(queryIncidents(items, { words: ['solana', 'drainer'], limit: 100 }).total, 1);
    assert.equal(queryIncidents(items, { words: ['solana', 'qilin'], limit: 100 }).total, 0);
    assert.equal(queryIncidents(items, { words: ['hacker'], limit: 100 }).total, 1); // matches the source name
    const limited = queryIncidents(items, { limit: 1 });
    assert.equal(limited.items.length, 1);
    assert.equal(limited.total, 3);
  });
});
