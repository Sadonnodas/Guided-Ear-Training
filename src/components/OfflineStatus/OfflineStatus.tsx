import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getOfflineAudioUrls } from '../../audio/offlineAssetUrls';
import './OfflineStatus.css';

const OFFLINE_DONE_KEY = 'offlineAudioCached_v1';
const PARALLEL_FETCHES = 6;

type Phase = 'idle' | 'caching' | 'cached' | 'error';

/**
 * Status banner + manual "Download for offline" flow.
 *
 * Workbox's precache pipeline can't reliably stash 140 MB of audio on iOS
 * Safari — cache.addAll() aborts on a single fetch failure, and iOS
 * silently evicts large caches under quota pressure, leaving the SW
 * thinking it has everything while the blobs are gone. So we precache
 * only the tiny app shell and let the user explicitly download the audio
 * (~135 MB) into the SW's runtime cache, with progress and per-file
 * error tolerance.
 */
export default function OfflineStatus() {
  const [phase, setPhase] = useState<Phase>(() => {
    return localStorage.getItem(OFFLINE_DONE_KEY) === '1' ? 'cached' : 'idle';
  });
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [dismissed, setDismissed] = useState(false);
  const cancelRef = useRef(false);

  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(err) {
      console.warn('Service worker registration failed:', err);
    },
  });

  // Persistent storage — important so iOS doesn't evict the runtime cache.
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => { /* ignore */ });
    }
  }, []);

  const startDownload = useCallback(async () => {
    if (phase === 'caching') return;
    cancelRef.current = false;

    const urls = getOfflineAudioUrls(import.meta.env.BASE_URL);
    setProgress({ done: 0, total: urls.length, failed: 0 });
    setPhase('caching');

    // Simple promise pool: PARALLEL_FETCHES requests in flight at any time.
    let cursor = 0;
    let done = 0;
    let failed = 0;

    const fetchOne = async () => {
      while (cursor < urls.length && !cancelRef.current) {
        const idx = cursor++;
        const url = urls[idx];
        try {
          // `cache: 'reload'` bypasses HTTP cache so the SW always sees a
          // network fetch and puts the response into its runtime cache.
          // The SW returns from cache afterwards (CacheFirst).
          const res = await fetch(url, { cache: 'reload' });
          if (!res.ok) failed++;
        } catch {
          failed++;
        }
        done++;
        // Throttle updates: every 4 items or at the end.
        if (done % 4 === 0 || done === urls.length) {
          setProgress({ done, total: urls.length, failed });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_FETCHES, urls.length) }, fetchOne)
    );

    setProgress({ done, total: urls.length, failed });

    if (cancelRef.current) {
      setPhase('idle');
      return;
    }

    if (failed < urls.length / 2) {
      localStorage.setItem(OFFLINE_DONE_KEY, '1');
      setPhase('cached');
    } else {
      setPhase('error');
    }
  }, [phase]);

  const cancel = () => { cancelRef.current = true; };

  const retry = () => {
    localStorage.removeItem(OFFLINE_DONE_KEY);
    setPhase('idle');
    setProgress({ done: 0, total: 0, failed: 0 });
  };

  if (dismissed && phase !== 'caching') return null;

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

  if (phase === 'caching') {
    const pct = progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
    return (
      <div className="offline-status caching">
        <div className="offline-status-text">
          <span>{progress.done} / {progress.total}</span>
          <span className="pct">{pct}%</span>
          {progress.failed > 0
            ? <span className="failed">· {progress.failed} skipped</span>
            : null}
        </div>
        <div className="offline-progress-bar">
          <div className="offline-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <button
          className="offline-status-close"
          onClick={cancel}
          aria-label="Cancel"
        >
          ×
        </button>
      </div>
    );
  }

  if (phase === 'cached') {
    return (
      <div className="offline-status ready">
        <span>✓ Offline ready</span>
        <button
          className="offline-status-link"
          onClick={retry}
          title="Re-download in case some files got evicted"
        >
          Re-cache
        </button>
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

  if (phase === 'error') {
    return (
      <div className="offline-status slow">
        <span>{progress.failed} files failed</span>
        <button className="offline-status-btn" onClick={startDownload}>Retry</button>
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

  // phase === 'idle'
  return (
    <div className="offline-status idle">
      <span title="Download all audio files (~135 MB) so the app works on a plane / without signal">
        Save for offline
      </span>
      <button className="offline-status-btn" onClick={startDownload}>
        Download
      </button>
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
