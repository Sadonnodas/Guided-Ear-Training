import type { MusicalKey, ScaleType, TrainingLevel } from '../../types';
import './Header.css';

// --- ICONS ---
const ShuffleIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>;
const TapeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12h20M2 8h20M2 16h20" /></svg>;
const StaticIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
const MetronomeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 20h16L12 2z" /><path d="M12 6v8" /></svg>;

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
  viewMode: 'tape' | 'static';
  setViewMode: (mode: 'tape' | 'static') => void;
  debugClick: boolean; 
  setDebugClick: (v: boolean) => void;
  scaleType: ScaleType;
  setScaleType: (s: ScaleType) => void;
  
  // Training Props
  activeLevelId?: number;
  setActiveLevelId?: (id: number) => void;
  levels?: TrainingLevel[];
}

export default function Header({ 
  activeTab, setActiveTab, currentKey, setKeyManually, pickRandomKey, 
  viewMode, setViewMode, debugClick, setDebugClick, scaleType, setScaleType,
  activeLevelId, setActiveLevelId, levels
}: HeaderProps) {

  const handleTabChange = (tab: string) => {
      setActiveTab(tab);
      if (tab === 'training' && scaleType === 'Chromatic') {
          setScaleType('Major');
      }
  };

  return (
    <>
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'random' ? 'active' : ''}`} onClick={() => handleTabChange("random")}>Random</button>
        <button className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`} onClick={() => handleTabChange("training")}>Training</button>
      </div>

      <div className="info-display">
        <div className="key-container">
          
          {/* SCALE TYPE */}
          <select 
            className="key-select" 
            value={scaleType} 
            onChange={(e) => setScaleType(e.target.value as ScaleType)}
            style={{ marginRight: '5px' }}
          >
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
            {/* Hide Chromatic in Training */}
            {/*{activeTab !== 'training' && <option value="Chromatic">Chromatic</option>}*/}
          </select>

          <div className="separator"></div>

          {/* KEY SELECTOR */}
          <select className="key-select" value={currentKey} onChange={(e) => setKeyManually(e.target.value as MusicalKey)}>
            {KEYS.map(k => (<option key={k} value={k}>{KEY_DISPLAY_MAP[k]}</option>))}
          </select>
          
          <button className="icon-btn" onClick={pickRandomKey} title="Random Key">
            <ShuffleIcon />
          </button>
          
          <div className="separator"></div>

          {/* LEVEL SELECTOR (TRAINING ONLY) */}
          {activeTab === 'training' && levels && setActiveLevelId && (
            <>
                <select 
                    className="level-select"
                    value={activeLevelId}
                    onChange={(e) => setActiveLevelId(Number(e.target.value))}
                >
                    {levels.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                </select>
                <div className="separator"></div>
            </>
          )}
          
          {/* VIEW TOGGLE */}
          <div className="view-toggle">
            <div className={`toggle-option ${viewMode === 'tape' ? 'active' : ''}`} onClick={() => setViewMode('tape')} title="Tape View">
              <TapeIcon />
            </div>
            <div className={`toggle-option ${viewMode === 'static' ? 'active' : ''}`} onClick={() => setViewMode('static')} title="Static View">
              <StaticIcon />
            </div>
            <div className={`toggle-pill ${viewMode}`} />
          </div>

          <div className="separator"></div>

          {/* METRONOME */}
          <button 
            className={`icon-btn ${debugClick ? 'active-pulse' : ''}`} 
            onClick={() => setDebugClick(!debugClick)} 
            title="Toggle Metronome"
            style={{color: debugClick ? 'var(--btn-play)' : 'inherit'}}
          >
            <MetronomeIcon />
          </button>
        </div>
      </div>
    </>
  );
}