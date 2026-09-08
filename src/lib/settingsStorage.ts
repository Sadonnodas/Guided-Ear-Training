/**
 * Settings that survive closing the app.
 *
 * Everything the user sets up before a session — difficulty, melody flow,
 * melodies per key, vocal range, key and scale, mixer levels — is written to
 * ONE localStorage entry and read back on the next launch, so reopening the
 * app on a phone lands on the setup you left rather than the factory defaults.
 *
 * One entry, not one key per setting: a single JSON blob is written whole, so
 * a half-finished write can never leave two settings disagreeing with each
 * other (the restored key and the restored scale, say).
 *
 * Writes are debounced because a volume slider fires on every pixel of a drag,
 * and localStorage is synchronous — a write per frame would be felt on the
 * phone. The pending write is flushed when the page is hidden, which is the
 * moment that matters on iOS: an installed PWA is suspended, not closed, and
 * a timer that has not fired yet never will.
 */

const STORAGE_KEY = 'get-settings-v1';
const FLUSH_DELAY_MS = 250;

type Bag = Record<string, unknown>;

function readAll(): Bag {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Bag)
      : {};
  } catch {
    // Corrupt JSON, or storage blocked entirely (Safari private mode).
    // Start from defaults rather than taking the app down with us.
    return {};
  }
}

const bag: Bag = readAll();
let flushTimer = 0;

function flush() {
  flushTimer = 0;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
  } catch {
    // Quota or private mode — settings simply do not persist this session.
  }
}

/** The stored value for `name`, or undefined if nothing was saved. */
export function readSetting(name: string): unknown {
  return bag[name];
}

/** Remember `value` under `name`. Hits the disk shortly after, not now. */
export function writeSetting(name: string, value: unknown) {
  bag[name] = value;
  if (flushTimer) return;
  flushTimer = window.setTimeout(flush, FLUSH_DELAY_MS);
}

/** Write anything still pending. Called when the page goes away. */
export function flushSettings() {
  if (!flushTimer) return;
  window.clearTimeout(flushTimer);
  flush();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSettings);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSettings();
  });
}
