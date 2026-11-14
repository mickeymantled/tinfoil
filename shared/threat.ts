import { THREAT_LEVELS, type Threat } from './types';

/**
 * THREAT LEVEL is a meme metric, not an official rating of anything.
 * It is derived from one number: how many incidents the feed picked up in the
 * last 24 hours. Minimum counts for each level, lowest first:
 */
export const THREAT_THRESHOLDS = [0, 15, 35, 60] as const;

export function computeThreat(count24h: number): Threat {
  let index = 0;
  for (let i = 0; i < THREAT_THRESHOLDS.length; i++) {
    if (count24h >= THREAT_THRESHOLDS[i]) index = i;
  }
  return { level: THREAT_LEVELS[index], index, count24h };
}

export function countLast24h(publishedDates: Iterable<string>, now = Date.now()): number {
  const cutoff = now - 24 * 60 * 60 * 1000;
  let n = 0;
  for (const iso of publishedDates) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t) && t >= cutoff && t <= now + 60_000) n++;
  }
  return n;
}
