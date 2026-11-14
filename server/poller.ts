import type { Incident, SourceStatus } from '../shared/types';
import { fetchSource, type CacheValidators, type FetchContext, type FetchResult } from './fetchers';
import type { SourceDef } from './sources';
import type { IncidentStore } from './store';

export interface PollerOptions {
  sources: SourceDef[];
  store: IncidentStore;
  intervalMs: number;
  timeoutMs: number;
  userAgent: string;
  /** Injected for tests. */
  fetchSource?: (source: SourceDef, ctx: FetchContext) => Promise<FetchResult>;
  log?: (line: string) => void;
}

export interface PollSummary {
  ok: number;
  failed: number;
  added: number;
  total: number;
  durationMs: number;
}

function describeError(err: unknown, timeoutMs: number): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return `timed out after ${timeoutMs}ms`;
  const cause = e?.cause?.code ?? e?.cause?.message;
  const msg = (e?.message ?? String(err)).slice(0, 200);
  return cause && !msg.includes(cause) ? `${msg} (${cause})` : msg;
}

export class Poller {
  private readonly opts: PollerOptions;
  private readonly status = new Map<string, SourceStatus>();
  private readonly validators = new Map<string, CacheValidators>();
  /** Sources whose last fetch was a 304 (for the log line). */
  private readonly notModified = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<PollSummary> | null = null;
  private stopped = false;
  lastPollAt: string | null = null;
  nextPollAt: string | null = null;

  constructor(opts: PollerOptions) {
    this.opts = opts;
    for (const s of opts.sources) {
      this.status.set(s.id, {
        id: s.id,
        name: s.name,
        url: s.url,
        ok: null,
        itemCount: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        durationMs: null,
        error: null,
      });
    }
  }

  get intervalMs(): number {
    return this.opts.intervalMs;
  }

  get polling(): boolean {
    return this.running !== null;
  }

  sourceStatuses(): SourceStatus[] {
    return this.opts.sources.map((s) => ({ ...this.status.get(s.id)! }));
  }

  /** Starts the schedule. With `pollNow`, the first poll runs immediately (not awaited). */
  start(pollNow: boolean): void {
    this.stopped = false;
    if (pollNow) void this.runAndReschedule();
    else this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextPollAt = null;
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.nextPollAt = new Date(Date.now() + this.opts.intervalMs).toISOString();
    this.timer = setTimeout(() => void this.runAndReschedule(), this.opts.intervalMs);
  }

  private async runAndReschedule(): Promise<void> {
    this.timer = null;
    try {
      await this.pollOnce();
    } catch (err) {
      (this.opts.log ?? console.error)(`[poll] unexpected error: ${(err as Error).stack ?? err}`);
    } finally {
      this.schedule();
    }
  }

  /** Runs one poll of every source. Concurrent calls share the in-flight poll (never overlap). */
  pollOnce(): Promise<PollSummary> {
    if (!this.running) {
      this.running = this.doPoll().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async pollSource(source: SourceDef): Promise<Incident[]> {
    const started = Date.now();
    const st = this.status.get(source.id)!;
    st.lastAttemptAt = new Date(started).toISOString();
    try {
      const res = await (this.opts.fetchSource ?? fetchSource)(source, {
        timeoutMs: this.opts.timeoutMs,
        userAgent: this.opts.userAgent,
        validators: this.validators.get(source.id),
      });
      this.validators.set(source.id, res.validators);
      st.ok = true;
      st.error = null;
      st.lastSuccessAt = new Date().toISOString();
      st.durationMs = Date.now() - started;
      // 304: nothing new; keep the previous item count (its items are already stored).
      if (res.notModified) {
        this.notModified.add(source.id);
        return [];
      }
      this.notModified.delete(source.id);
      st.itemCount = res.items.length;
      return res.items;
    } catch (err) {
      st.ok = false;
      st.error = describeError(err, this.opts.timeoutMs);
      st.durationMs = Date.now() - started;
      return [];
    }
  }

  private async doPoll(): Promise<PollSummary> {
    const started = Date.now();
    const { sources, store } = this.opts;
    // pollSource never throws, so every source settles independently.
    const results = await Promise.all(sources.map((s) => this.pollSource(s)));
    const fresh = results.flat();
    const repeatNames = new Set(sources.filter((s) => s.repeatTitles).map((s) => s.name));
    const { added, changed } = store.merge(fresh, { repeatTitles: (name) => repeatNames.has(name) });
    if (changed) {
      try {
        await store.save();
      } catch (err) {
        (this.opts.log ?? console.error)(`[store] save failed: ${(err as Error).message}`);
      }
    }
    this.lastPollAt = new Date().toISOString();

    const statuses = this.sourceStatuses();
    const ok = statuses.filter((s) => s.ok).length;
    const failed = statuses.length - ok;
    const summary: PollSummary = { ok, failed, added, total: store.size, durationMs: Date.now() - started };
    const parts = statuses.map((s) => (s.ok ? `${s.id}=${s.itemCount}${this.notModified.has(s.id) ? '(304)' : ''}` : `${s.id}=FAIL(${s.error})`));
    (this.opts.log ?? console.log)(
      `[poll] ${ok}/${statuses.length} sources ok, ${failed} failed | +${added} new, ${store.size} total | ${summary.durationMs}ms | ${parts.join(' ')}`,
    );
    return summary;
  }
}
