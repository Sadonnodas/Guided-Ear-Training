import { useState } from 'react';
import { checkForUpdate, applyUpdate, buildDate } from '../../lib/appUpdate';
import type { UpdateCheck } from '../../lib/appUpdate';
import './UpdateChecker.css';

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
);

type State = 'idle' | 'checking' | UpdateCheck | 'updating';

/**
 * "Check for updates" for the More tab.
 *
 * Three outcomes, and the third is the one worth being careful about: a check
 * that could not reach the server reports that it failed, never that you are
 * current. Telling someone they have the latest build when you did not manage
 * to look is the failure this button exists to prevent.
 */
export default function UpdateChecker() {
  const [state, setState] = useState<State>('idle');

  const runCheck = async () => {
    setState('checking');
    setState(await checkForUpdate());
  };

  const runUpdate = async () => {
    setState('updating');
    await applyUpdate();
  };

  const busy = state === 'checking' || state === 'updating';
  // Once an update is found the button becomes the update, and stays it while
  // that runs — a control that reverts to "Check for updates" mid-download
  // reads as the update having failed.
  const offersUpdate = state === 'available' || state === 'updating';

  return (
    <div className="update-checker">
      <div className="update-build">Built {buildDate()}</div>

      {offersUpdate ? (
        <button className="update-btn accent" onClick={runUpdate} disabled={busy}>
          <DownloadIcon />
          <span>{state === 'updating' ? 'Updating…' : 'Get the new version'}</span>
        </button>
      ) : (
        <button className="update-btn" onClick={runCheck} disabled={busy}>
          <RefreshIcon />
          <span>{state === 'checking' ? 'Checking…' : 'Check for updates'}</span>
        </button>
      )}

      {state === 'updating' && <p className="update-note">Fetching and restarting…</p>}
      {state === 'current' && <p className="update-note ok">You have the latest version.</p>}
      {state === 'available' && <p className="update-note">A newer version is available.</p>}
      {state === 'failed' && (
        <p className="update-note warn">
          Couldn't reach the server, so there is no telling. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
