import { useCallback, useEffect, useMemo, useState } from 'react';

export const STORAGE_KEY = 'tinfoil-hat:survival:v1';

type CheckedMap = Record<string, true>;

/**
 * localStorage access that never throws. Private mode, disabled storage and
 * some in-app browsers throw on access; we then keep state in memory only.
 */
function readStored(validIds: ReadonlySet<string>): CheckedMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CheckedMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      // Unknown ids are dropped so checklist content can change between versions.
      if (value === true && validIds.has(id)) out[id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(map: CheckedMap): void {
  try {
    if (Object.keys(map).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable or full: state stays in memory for this visit.
  }
}

export function useChecklist(allIds: readonly string[]) {
  const validIds = useMemo(() => new Set(allIds), [allIds]);
  const [checked, setChecked] = useState<CheckedMap>(() => readStored(validIds));

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setChecked(readStored(validIds));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [validIds]);

  const toggle = useCallback((id: string, value: boolean) => {
    setChecked((prev) => {
      const next: CheckedMap = { ...prev };
      if (value) next[id] = true;
      else delete next[id];
      writeStored(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeStored({});
    setChecked({});
  }, []);

  const count = allIds.reduce((n, id) => (checked[id] ? n + 1 : n), 0);
  const total = allIds.length;
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);

  return { checked, toggle, reset, count, total, percent };
}
