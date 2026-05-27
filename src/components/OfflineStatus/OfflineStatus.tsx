import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './OfflineStatus.css';

/**
 * Small status banner that tells the user when the app has finished
 * downloading its assets to the offline cache, and when a new version is
 * available. Renders nothing once the user has acknowledged the state.
 *
 * Also asks the browser for persistent storage so iOS doesn't evict the
 * ~140 MB cache under storage pressure — without this, Safari can quietly
 * drop the precached samples and offline mode starts failing.
 */
export default function OfflineStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Reasonable hint to the user that something is happening even before
      // the precache finishes.
      if (registration && registration.installing) {
        setInstalling(true);
      }
    },
    onRegisterError(err) {
      console.warn('SW registration failed', err);
    },
  });

  const [installing, setInstalling] = useState(false);

  // Ask for persistent storage once on mount. If granted, the browser won't
  // evict our cache when disk pressure rises — important for the 140 MB of
  // samples we precache for offline use.
  useEffect(() => {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(() => { /* ignore */ });
    }
  }, []);

  // Once offline-ready, the installing-state hint isn't useful anymore.
  useEffect(() => {
    if (offlineReady) setInstalling(false);
  }, [offlineReady]);

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
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="offline-status ready">
        <span>✓ Ready for offline use</span>
        <button
          className="offline-status-close"
          onClick={() => setOfflineReady(false)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (installing) {
    return (
      <div className="offline-status installing">
        <span>Caching for offline… keep this tab open</span>
      </div>
    );
  }

  return null;
}
