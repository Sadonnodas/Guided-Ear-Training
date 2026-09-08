/**
 * Checking for, and pulling in, a newer build.
 *
 * An installed PWA on iOS is suspended rather than closed, so it can keep
 * running a build from weeks ago while the fix sits live on Pages. This gives
 * the user a way to ask.
 *
 * The check deliberately does NOT ask the service worker whether an update
 * exists. A registration can vanish underneath the app — Safari evicts workers
 * for sites left alone about a week — and the stale handle goes on answering
 * update() without complaint, so the app would report "you are on the latest
 * version" from a page that has no way left to get a new one. Instead we fetch
 * index.html ourselves and compare the script it wants against the script this
 * page actually loaded: it needs no version endpoint, cannot be fooled by a
 * cached response, and works with no worker at all.
 */

const BASE = import.meta.env.BASE_URL;

export type UpdateCheck = 'current' | 'available' | 'failed';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function basename(path: string): string {
  const clean = path.split('?')[0].split('#')[0];
  return clean.slice(clean.lastIndexOf('/') + 1);
}

/** The hashed bundle names a freshly fetched index.html asks for. */
function wantedScripts(html: string): string[] {
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const name = basename(match[1]);
    if (name) out.push(name);
  }
  return out;
}

/** The bundle names this running page loaded. */
function loadedScripts(): Set<string> {
  const names = [...document.querySelectorAll('script[src]')]
    .map((el) => basename(el.getAttribute('src') ?? ''))
    .filter(Boolean);
  return new Set(names);
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  try {
    // The query string matters: without it the service worker answers this
    // from its own precache — the old index.html — and every check would
    // report an update that is already installed, forever.
    const res = await fetch(`${BASE}index.html?update-check=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return 'failed';

    const wanted = wantedScripts(await res.text());
    // No script tags means we did not get an index.html — a captive portal
    // login page, say. Not knowing is not the same as being up to date.
    if (wanted.length === 0) return 'failed';

    const loaded = loadedScripts();
    if (!wanted.every((name) => loaded.has(name))) return 'available';

    // We reached the server and it named the bundle we are already running.
    // One way that could still be wrong: if the service worker answered the
    // fetch out of its own precache, it handed us the OLD index and we just
    // agreed with ourselves. A stray query string should stop it matching the
    // precache entry, but "should" is thin for the one branch that tells the
    // user there is nothing to get. So ask the worker too, and let either
    // signal count as an update.
    return (await workerHasNewBuild()) ? 'available' : 'current';
  } catch {
    // Offline, DNS, CORS — anything that means we did not hear back.
    return 'failed';
  }
}

/**
 * Whether the service worker is holding, or fetching, a build newer than the
 * one running. Deliberately only ever used to turn a 'current' into an
 * 'available': a worker that says nothing proves nothing, because a stale
 * registration answers update() without complaint.
 */
async function workerHasNewBuild(): Promise<boolean> {
  try {
    if (!navigator.serviceWorker?.controller) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await Promise.race([reg.update(), delay(4000)]);
    return Boolean(reg.waiting || reg.installing);
  } catch {
    return false;
  }
}


export async function applyUpdate(): Promise<void> {
  // Let the worker pull the new precache in first, so the reload is served
  // the new build rather than the one it already holds. Never wait on it:
  // update() can hang indefinitely, and the reload is what was asked for.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await Promise.race([reg.update(), delay(5000)]);
  } catch {
    // No worker, or it refused. The fetch below still gets us there.
  }

  // With no worker in play, location.reload() does not escape the HTTP cache:
  // Pages serves index.html with a max-age, and a reload inside that window is
  // answered with the very document we are trying to replace — a quiet loop
  // that never converges. Forcing one network fetch rewrites the cached entry.
  try {
    await fetch(BASE, { cache: 'reload' });
  } catch {
    // Went offline mid-update; the reload below shows what it can.
  }

  location.reload();
}

/** When this build was made, as a readable local date. */
export function buildDate(): string {
  const parsed = new Date(__APP_VERSION__);
  if (Number.isNaN(parsed.getTime())) return __APP_VERSION__;
  return parsed.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
