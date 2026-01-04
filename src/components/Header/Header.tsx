import type { MusicalKey } from '../../types';
import './Header.css';

// --- ICONS ---
const ShuffleIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>;

// Icon for "Tape" view (Waves/Strip)
const TapeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M2 12h20M2 8h20M2 16h20" />
  </svg>
);

// Icon for "Static" view (Grid/Boxes)
const StaticIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentKey: MusicalKey;
  setKeyManually: (k: MusicalKey) => void;
  pickRandomKey: () => void;
  status: string;
  viewMode: 'tape' | 'static';
  setViewMode: (mode: 'tape' | 'static') => void;
}

export default function Header({ 
  activeTab, setActiveTab, currentKey, setKeyManually, pickRandomKey, status, viewMode, setViewMode 
}: HeaderProps) {
  return (
    <>
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'random' ? 'active' : ''}`} onClick={() => setActiveTab("random")}>Random</button>
        <button className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`} onClick={() => setActiveTab("training")}>Training</button>
      </div>

      <div className="info-display">
        <div className="key-container">
          <select className="key-select" value={currentKey} onChange={(e) => setKeyManually(e.target.value as MusicalKey)}>
            {KEYS.map(k => (<option key={k} value={k}>{KEY_DISPLAY_MAP[k]} Major</option>))}
          </select>
          
          <button className="icon-btn" onClick={pickRandomKey} title="Random Key">
            <ShuffleIcon />
          </button>
          
          <div className="separator"></div>
          
          {/* --- NEW TOGGLE SWITCH --- */}
          <div className="view-toggle">
            <div 
              className={`toggle-option ${viewMode === 'tape' ? 'active' : ''}`}
              onClick={() => setViewMode('tape')}
              title="Tape View"
            >
              <TapeIcon />
            </div>
            <div 
              className={`toggle-option ${viewMode === 'static' ? 'active' : ''}`}
              onClick={() => setViewMode('static')}
              title="Static View"
            >
              <StaticIcon />
            </div>
            {/* The sliding pill background */}
            <div className={`toggle-pill ${viewMode}`} />
          </div>
          {/* ------------------------- */}

        </div>
        <div className="status-text">{status}</div>
      </div>
    </>
  );
}