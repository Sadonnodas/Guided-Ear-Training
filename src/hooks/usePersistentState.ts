import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readSetting, writeSetting } from '../lib/settingsStorage';

/**
 * useState that remembers itself across launches.
 *
 * `revive` is required rather than optional on purpose: what comes back out of
 * storage was written by an older build of the app and cannot be trusted to
 * still be a legal value. A difficulty that was renamed, a degree that no
 * longer exists in the current scale, a volume of NaN — each would surface far
 * from here as a silent misbehaviour. Returning undefined from `revive` falls
 * back to the default, which is always safe.
 */
export function usePersistentState<T>(
  name: string,
  fallback: T,
  revive: (raw: unknown) => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = readSetting(name);
    if (raw === undefined) return fallback;
    const revived = revive(raw);
    return revived === undefined ? fallback : revived;
  });

  useEffect(() => { writeSetting(name, value); }, [name, value]);

  return [value, setValue];
}

// ── Revivers ─────────────────────────────────────────────────────────────────

export const asBool = (raw: unknown): boolean | undefined =>
  typeof raw === 'boolean' ? raw : undefined;

/** A finite number inside [min, max]. Rejects NaN, which JSON stores as null. */
export const asNumber = (min: number, max: number) => (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max
    ? raw
    : undefined;

export const asInt = (min: number, max: number) => (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max
    ? raw
    : undefined;

export const asOneOf = <T extends string>(allowed: readonly T[]) => (raw: unknown): T | undefined =>
  typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;

/**
 * A non-empty array whose every entry survives `item`. One bad entry rejects
 * the whole array: a half-restored list of enabled degrees is worse than the
 * default, because it looks deliberate.
 */
export const asArrayOf = <T>(item: (raw: unknown) => T | undefined) => (raw: unknown): T[] | undefined => {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: T[] = [];
  for (const entry of raw) {
    const revived = item(entry);
    if (revived === undefined) return undefined;
    out.push(revived);
  }
  return out;
};
