import type { MusicalKey, ScaleType, TrainingLevel, CagedShape} from '../../types';
import './Header.css';

// --- ICONS ---
const ShuffleIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>;
const TapeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12h20M2 8h20M2 16h20" /></svg>;
const StaticIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
const LockIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>;


const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

/**
 * FIX #2: Build an ordered key list centred on the "natural" key for each
 * scale type.  Above centre = increasing sharps; below centre = increasing flats.
 *
 * Major scale:  C (0 acc)  → G D A E B F♯ (↑sharps) | F B♭ E♭ A♭ D♭ G♭ (↓flats)
 * Minor scale:  A (0 acc)  → E B F♯ C♯ G♯ D♯  (↑sharps) | D G C F B♭ E♭ (↓flats)
 *
 * The <select> renders top-to-bottom, so we put the *most-sharps* key first
 * and the *most-flats* key last, with the natural key in the exact middle.
 */
function getOrderedKeys(scaleType: string): { key: MusicalKey; label: string }[] {
  // Circle of fifths order starting from C:  C G D A E B F♯/G♭ D♭ A♭ E♭ B♭ F
  // Sharps above centre (going up the circle), flats below (going down)

  // For Major: C = 0 accidentals
  //   Sharps: G(1) D(2) A(3) E(4) B(5) F♯(6)
  //   Flats:  F(1) B♭(2) E♭(3) A♭(4) D♭(5) G♭(6)
  const majorSharps: MusicalKey[] = ["G", "D", "A", "E", "B", "Fs"];
  const majorFlats: MusicalKey[]  = ["F", "As", "Ds", "Gs", "Cs", "Fs"]; // Fs = G♭ enharmonic

  // For Minor: A = 0 accidentals
  //   Sharps: E(1) B(2) F♯(3) C♯(4) G♯(5) D♯(6)
  //   Flats:  D(1) G(2) C(3) F(4) B♭(5) E♭(6)
  const minorSharps: MusicalKey[] = ["E", "B", "Fs", "Cs", "Gs", "Ds"];
  const minorFlats: MusicalKey[]  = ["D", "G", "C", "F", "As", "Ds"]; // Ds = E♭ enharmonic

  const isMinor = scaleType === 'Minor' || scaleType === 'PentatonicMinor';
  const centre: MusicalKey   = isMinor ? "A" : "C";
  const sharps: MusicalKey[] = isMinor ? minorSharps : majorSharps;
  const flats: MusicalKey[]  = isMinor ? minorFlats  : majorFlats;

  // Build list: most-sharps first → centre → most-flats last
  // We deduplicate so the enharmonic overlap (F♯/G♭, D♯/E♭) only appears once.
  const seen = new Set<MusicalKey>();
  const ordered: MusicalKey[] = [];

  // Sharps in descending order (most sharps → fewest)
  for (let i = sharps.length - 1; i >= 0; i--) {
    if (!seen.has(sharps[i])) { seen.add(sharps[i]); ordered.push(sharps[i]); }
  }

  // Centre
  if (!seen.has(centre)) { seen.add(centre); ordered.push(centre); }

  // Flats in ascending order (fewest flats → most)
  for (let i = 0; i < flats.length; i++) {
    if (!seen.has(flats[i])) { seen.add(flats[i]); ordered.push(flats[i]); }
  }

  // Any remaining chromatic keys not yet covered (safety net)
  KEYS.forEach(k => {
    if (!seen.has(k)) { seen.add(k); ordered.push(k); }
  });

  return ordered.map(k => ({ key: k, label: KEY_DISPLAY_MAP[k] }));
}

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentKey: MusicalKey;
  setKeyManually: (k: MusicalKey) => void;
  viewMode: 'tape' | 'static';
  setViewMode: (mode: 'tape' | 'static') => void;
  
  scaleType: ScaleType;
  setScaleType: (s: ScaleType) => void;
  
  activeLevelId?: number;
  setActiveLevelId?: (id: number) => void;
  levels?: TrainingLevel[];
  selectedShape?: CagedShape;
  setSelectedShape?: (s: CagedShape) => void;
  isLevelUnlocked?: (id: number) => boolean;
  
  // NEW: For stopping playback when fretboard settings change
  isPlaying?: boolean;
  stopSession?: () => void;
}

export default function Header({ 
  activeTab, setActiveTab, currentKey, setKeyManually, 
  viewMode, setViewMode, scaleType, setScaleType,
  activeLevelId, setActiveLevelId, levels,
  selectedShape, setSelectedShape,
  isLevelUnlocked,
  isPlaying, stopSession
}: HeaderProps) {

  const handleTabChange = (tab: string) => {
      setActiveTab(tab);
      if (tab === 'training' && scaleType === 'Chromatic') {
          setScaleType('Major');
      }
  };

  // NEW: Handle scale type change - stop if playing in fretboard mode
  const handleScaleTypeChange = (newScaleType: ScaleType) => {
    if (activeTab === 'fretboard' && isPlaying && stopSession) {
      stopSession();
    }
    setScaleType(newScaleType);
  };

  // NEW: Handle shape change - stop if playing in fretboard mode
  const handleShapeChange = (newShape: CagedShape) => {
    if (activeTab === 'fretboard' && isPlaying && stopSession && setSelectedShape) {
      stopSession();
      setSelectedShape(newShape);
    } else if (setSelectedShape) {
      setSelectedShape(newShape);
    }
  };

  // NEW: Handle key change - stop if playing in fretboard mode, otherwise modulate gracefully
  const handleKeyChange = (newKey: MusicalKey) => {
    // FIX: Ignore clicks during tutorial
    if (document.body.dataset.tutorialActive === 'true') return;
    
    if (activeTab === 'fretboard' && isPlaying && stopSession) {
      stopSession();
    }
    setKeyManually(newKey);
  };

  return (
    <>
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'random' ? 'active' : ''}`} 
          onClick={() => handleTabChange("random")}
          title="Random Mode: Freeform practice with full control over scale degrees"
        >
          Random
        </button>
        <button 
          className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`} 
          onClick={() => handleTabChange("training")}
          title="Training Mode: Structured curriculum with progressive levels"
        >
          Training
        </button>
        <button 
          className={`tab-btn ${activeTab === 'fretboard' ? 'active' : ''}`} 
          onClick={() => handleTabChange("fretboard")}
          title="Fretboard Mode: Guitar-specific practice using CAGED system"
        >
          Fretboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'progressions' ? 'active' : ''}`} 
          onClick={() => handleTabChange("progressions")}
          title="Progressions Mode: Chord progression recognition training"
        >
          Progressions
        </button>
      </div>

      <div className="info-display">
        <div className="key-container">
          
          {/* SCALE TYPE */}
          <select 
            className="key-select scale-type-select" 
            value={scaleType} 
            onChange={(e) => handleScaleTypeChange(e.target.value as ScaleType)}
            title="Select the scale type for practice"
          >
            {activeTab === 'fretboard' ? (
              <>
                <option value="PentatonicMajor">Major Pentatonic</option>
                <option value="PentatonicMinor">Minor Pentatonic</option>
              </>
            ) : activeTab === 'training' || activeTab === 'progressions' ? (
              <>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
              </>
            ) : (
              <>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
                <option value="PentatonicMajor">Major Pentatonic</option>
                <option value="PentatonicMinor">Minor Pentatonic</option>
              </>
            )}
          </select>

          <div className="separator"></div>

          {/* KEY SELECTOR */}
          <select 
            className="key-select key-pitch-select" 
            value={currentKey} 
            onChange={(e) => handleKeyChange(e.target.value as MusicalKey)}
            title="Select the musical key - arranged by circle of fifths (sharps above, flats below)"
          >
            {getOrderedKeys(scaleType).map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          <button 
            className="icon-btn" 
            onClick={() => handleKeyChange(KEYS[Math.floor(Math.random() * KEYS.length)])} 
            title="Pick a random key to practice in"
          >
            <ShuffleIcon />
          </button>
          

          {/* LEVEL SELECTOR (TRAINING ONLY) */}
          {activeTab === 'training' && levels && setActiveLevelId && (
            <>
                <select 
                    className="level-select"
                    value={activeLevelId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      // Only allow selection if unlocked
                      if (!isLevelUnlocked || isLevelUnlocked(id)) {
                        setActiveLevelId(id);
                      }
                    }}
                    title="Select training level - complete previous levels to unlock"
                >
                    {levels.map(l => {
                      const locked = isLevelUnlocked && !isLevelUnlocked(l.id);
                      return (
                        <option key={l.id} value={l.id} disabled={locked}>
                          {locked && <><LockIcon /> </>}{l.name}
                        </option>
                      );
                    })}
                </select>
                
            </>
          )}
          
          <div className="separator"></div>

          {/* DYNAMIC TOGGLE: View Mode or Shape Selector */}
          {activeTab === 'fretboard' && setSelectedShape ? (
            <select 
              className="key-select shape-select" 
              value={selectedShape} 
              onChange={(e) => handleShapeChange(e.target.value as CagedShape)}
              title="Select CAGED shape position on the fretboard"
            >
              <option value="C">C-Shape</option>
              <option value="A">A-Shape</option>
              <option value="G">G-Shape</option>
              <option value="E">E-Shape</option>
              <option value="D">D-Shape</option>
            </select>
          ) : (
            <div className="view-toggle" title="Switch between visualization modes">
              <div 
                className={`toggle-option ${viewMode === 'tape' ? 'active' : ''}`} 
                onClick={() => setViewMode('tape')} 
                title="Tape View: Scrolling visualization showing melody progression"
              >
                <TapeIcon />
              </div>
              <div 
                className={`toggle-option ${viewMode === 'static' ? 'active' : ''}`} 
                onClick={() => setViewMode('static')} 
                title="Static View: Grid layout with all degrees always visible"
              >
                <StaticIcon />
              </div>
              <div className={`toggle-pill ${viewMode}`} />
            </div>
          )}
          
        </div>
      </div>
    </>
  );
}