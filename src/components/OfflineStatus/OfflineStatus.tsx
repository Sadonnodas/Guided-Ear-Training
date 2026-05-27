import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './OfflineStatus.css';

/**
 * Status banner that surfaces the offline cache state to the user:
 *  - "Caching for offline…" while the SW is downloading its precache
 *  - "Updating offline cache…" if an update is downloading while a previous
 *    cache is already serving the app
 *  - "✓ Ready for offline use" once a SW is controlling the page
 *  - "New version available" when a fresh SW is waiting
 *  - "Cache is taking a while…" if installing hasn't completed in a long time
 *    (helps catch the case where a single bad fetch makes the install hang)
 *
 * Also requests persistent storage so iOS doesn't evict the ~140 MB cache
 * under storage pressure.
 */
export default function OfflineStatus() {
  const [hasController, setHasController] = useState(
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller
  );
  const [installing, setInstalling] = useState(false);
  const [installStart, setInstallStart] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const slowTimerRef = useRef<number | null>(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // Watch the lifecycle of a given SW (install → activated/redundant)
      // so we know exactly when the precache finishes for any new SW that
      // shows up — not just the first one.
      const track = (sw: ServiceWorker) => {
        const onState = () => {
          if (sw.state === 'installing') {
            beginInstalling();
          } else if (sw.state === 'activated') {
            endInstalling();
            setHasController(true);
          } else if (sw.state === 'redundant') {
            endInstalling();
          }
        };
        onState();
        sw.addEventListener('statechange', onState);
      };

      if (registration.installing) track(registration.installing);
      if (registration.waiting) track(registration.waiting);

      registration.addEventListener('updatefound', () => {
        if (registration.installing) track(registration.installing);
      });
    },
    onRegisterError(err) {
      console.warn('Service worker registration failed:', err);
    },
  });

  function beginInstalling() {
    setInstalling(true);
    setInstallStart((prev) => prev ?? Date.now());
    if (slowTimerRef.current === null) {
      // After ~3 minutes of installing, flag it as slow so the banner can
      // explain what's happening instead of silently spinning.
      slowTimerRef.current = window.setTimeout(() => setSlow(true), 3 * 60 * 1000);
    }
  }

  function endInstalling() {
    setInstalling(false);
    setInstallStart(null);
    setSlow(false);
    if (slowTimerRef.current !== null) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  }

  // skipWaiting + clientsClaim make the new SW take control mid-session.
  // 'controllerchange' fires when that happens — flip ready on.
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const onCtrl = () => setHasController(!!navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
  }, []);

  // Ask for persistent storage once. Without this, iOS can evict the
  // 140 MB cache under disk pressure and offline mode quietly breaks.
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => { /* ignore */ });
    }
  }, []);

  // Clean up the slow-install timer on unmount.
  useEffect(() => () => {
    if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
  }, []);

  if (dismissed) return null;

  if (needRefresh) {
    return (
      <div className="offline-status update">
        <span>New version available</span>
        <button
          className="offline-status-btn"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
        <button
          className="offline-status-close"
          onClick={() => { setNeedRefresh(false); setDismissed(true); }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  // Currently installing.
  if (installing) {
    const minutes = installStart ? Math.floor((Date.now() - installStart) / 60000) : 0;
    if (slow) {
      return (
        <div className="offline-status slow">
          <span>
            Cache is taking a while ({minutes} min) — try reloading if it
            doesn't finish soon
          </span>
          <button
            className="offline-status-close"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      );
    }
    return (
      <div className={hasController ? 'offline-status updating' : 'offline-status installing'}>
        <span>
          {hasController
            ? 'Updating offline cache… current version still works offline'
            : 'Caching for offline… keep this tab open'}
        </span>
      </div>
    );
  }

  // Active SW means offline is ready.
  if (offlineReady || hasController) {
    return (
      <div className="offline-status ready">
        <span>✓ Ready for offline use</span>
        <button
          className="offline-status-close"
          onClick={() => { setOfflineReady(false); setDismissed(true); }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
