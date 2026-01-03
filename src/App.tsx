import { useState, useEffect, useRef } from "react";
import { audioEngine } from "./audio/AudioEngine";
import { generateMelody } from "./core/MelodyGenerator";
import type { MusicalKey, ScaleDegree } from "./types";
import "./App.css";

const PlayIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const StopIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>;
const ShuffleIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>;
const ChevronIcon = ({open}: {open: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}><path d="M6 9l6 6 6-6"/></svg>;

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const TEMPOS = [60, 80, 100, 120, 150];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

// --- VISUAL PULSE SYNC ---
const PULSE_OFFSET = -0.05; // Adjust this to sync button pulse

export default function App() {
  const [activeTab, setActiveTab] = useState("random");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  const [status, setStatus] = useState("Start Session");
  const [activeDegree, setActiveDegree] = useState<string | null>(null);
  const [bpm, setBpm] = useState(80);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);

  // Volumes
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.5);
  // volClick still exists in state for engine, but removed from UI
  const [volClick, setVolClick] = useState(0.5); 
  const [volReverb, setVolReverb] = useState(0.3);

  const prevVol = useRef<Record<string, number>>({});

  const [startRoot, setStartRoot] = useState(false);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(false);

  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const visualTimeoutRef = useRef<number>(0); 

  useEffect(() => {
    audioEngine.onNotePlay = (note, isClick) => {
      if (isClick) return; 
      if (note) {
        setActiveDegree(note.noteInfo.degree);
        if (visualTimeoutRef.current) clearTimeout(visualTimeoutRef.current);
        const secPerBeat = 60 / bpm;
        const holdTime = (note.duration * secPerBeat * 1000) - 100; 
        visualTimeoutRef.current = setTimeout(() => setActiveDegree(null), holdTime);
      }
    };
    
    audioEngine.setMasterVol(volMaster);
    audioEngine.setDroneVol(volDrone);
    audioEngine.setDrumVol(volGroove);
    audioEngine.setVocalVol(volVoice);
    audioEngine.setClickVol(volClick);
    audioEngine.setReverbMix(volReverb);
    audioEngine.setBpm(bpm);

  }, [volMaster, volDrone, volGroove, volVoice, volClick, volReverb, bpm]);

  const toggleDegree = (d: ScaleDegree) => {
    setEnabledDegrees(prev => {
        if (prev.includes(d)) {
            if (prev.length === 1) return prev; 
            return prev.filter(x => x !== d);
        }
        return [...prev, d].sort();
    });
  };

  const toggleMute = (type: string, val: number, setter: (v: number) => void) => {
    if (val > 0) {
        prevVol.current[type] = val;
        setter(0);
    } else {
        setter(prevVol.current[type] || 0.5);
    }
  };

  const pickRandomKey = () => {
    const otherKeys = KEYS.filter(k => k !== currentKey);
    return otherKeys[Math.floor(Math.random() * otherKeys.length)];
  };

  const setKeyManually = async (k: MusicalKey) => {
    setCurrentKey(k);
    if (isPlaying) {
      setStatus(`Changing to ${KEY_DISPLAY_MAP[k]} next...`);
      questionCount.current = 10;
    } else {
      setStatus(`Key: ${KEY_DISPLAY_MAP[k]}`);
      await audioEngine.loadBackingTracks(k, "groove_1_80bpm.mp3");
    }
  };

  const startSession = async () => {
    if (!isPlaying) {
      try {
        setStatus("Initializing...");
        await audioEngine.init({
            drone: volDrone,
            groove: volGroove,
            voice: volVoice,
            click: volClick,
            master: volMaster
        });
        
        audioEngine.setBpm(bpm);
        setStatus("Loading...");
        await audioEngine.loadBackingTracks(currentKey, "groove_1_80bpm.mp3");
        setIsPlaying(true);
        isPlayingRef.current = true;
        runCycle(currentKey);
      } catch (e) { console.error(e); setStatus("Error"); }
    } else {
      stopSession();
    }
  };

  const stopSession = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    audioEngine.reset(); 
    setStatus("Paused");
    setActiveDegree(null);
  };

  const runCycle = async (keyToUse: MusicalKey) => {
    if (!isPlayingRef.current) return;
    
    // Explicitly clear visual state before resetting
    setActiveDegree(null);
    audioEngine.reset();

    questionCount.current += 1;
    let nextKey = keyToUse;

    if (questionCount.current > 10) {
        questionCount.current = 0;
        nextKey = pickRandomKey();
        setCurrentKey(nextKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[nextKey]}...`);
        await audioEngine.loadBackingTracks(nextKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 1000));
    } else if (keyToUse !== currentKey) {
        nextKey = currentKey;
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[nextKey]}...`);
        await audioEngine.loadBackingTracks(nextKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 1000));
    }

    setStatus(silentPractice ? "Listen & Repeat" : "Listen");
    
    const melody = generateMelody({
        length: 4, 
        key: nextKey, 
        scaleType: "Major",
        startOnRoot: startRoot,
        endOnRoot: endRoot,
        activeDegrees: enabledDegrees
    });
    
    await audioEngine.preloadNotes(melody);

    audioEngine.scheduleRoutine(melody, silentPractice, () => {
        if (isPlayingRef.current) {
            runCycle(currentKey);
        }
    });

    audioEngine.startPlayback();
  };

  const pulseStyle = isPlaying 
    ? { 
        animationDuration: `${60 / bpm}s`,
        animationDelay: `${PULSE_OFFSET}s` 
      } 
    : {};

  return (
    <div className="app-container">
      <div className="main-panel">
        
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'random' ? 'active' : ''}`} onClick={() => setActiveTab("random")}>Random</button>
          <button className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`} onClick={() => setActiveTab("training")}>Training</button>
        </div>

        <div className="info-display">
          <div className="key-container">
            <select className="key-select" value={currentKey} onChange={(e) => setKeyManually(e.target.value as MusicalKey)}>
              {KEYS.map(k => (<option key={k} value={k}>{KEY_DISPLAY_MAP[k]} Major</option>))}
            </select>
            <button className="icon-btn" onClick={() => setKeyManually(pickRandomKey())} title="Random Key">
              <ShuffleIcon />
            </button>
          </div>
          <div className="status-text">{status}</div>
        </div>

        <div className="visualizer">
          {["1", "2", "3", "4", "5", "6", "7"].map((degree) => {
            const isEnabled = enabledDegrees.includes(degree as ScaleDegree);
            const isActive = activeDegree === degree;
            return (
              <div 
                key={degree} 
                data-degree={degree}
                className={`degree-bubble ${isEnabled ? 'enabled' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => toggleDegree(degree as ScaleDegree)}
              >
                {degree}
              </div>
            );
          })}
        </div>

        <button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={startSession}
          style={pulseStyle}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>

        <div className="settings-trigger" onClick={() => setSettingsOpen(!settingsOpen)}>
          <span>Controls</span>
          <ChevronIcon open={settingsOpen} />
        </div>

        <div className={`controls-accordion ${settingsOpen ? 'open' : ''}`}>
          <div className="controls-content">
            
            <div className="toggle-grid">
               <div className={`toggle-card ${startRoot ? 'active' : ''}`} onClick={() => setStartRoot(!startRoot)}>Start on 1</div>
               <div className={`toggle-card ${endRoot ? 'active' : ''}`} onClick={() => setEndRoot(!endRoot)}>End on 1</div>
               <div className={`toggle-card ${silentPractice ? 'active' : ''}`} onClick={() => setSilentPractice(!silentPractice)}>Silent Mode</div>
            </div>

            <div className="tempo-row">
              {TEMPOS.map(t => (
                  <button key={t} disabled={t !== 80} className={`tempo-btn ${bpm === t ? 'active' : ''}`} onClick={() => setBpm(t)}>{t}</button>
              ))}
            </div>
            
            <div className="slider-row">
              <span style={{fontWeight:'bold'}}>Master</span>
              <input type="range" min="0" max="1" step="0.05" value={volMaster} onChange={e => setVolMaster(parseFloat(e.target.value))} />
            </div>

            <div className="slider-row">
              <span onClick={() => toggleMute('voice', volVoice, setVolVoice)} className={volVoice===0 ? 'muted-label' : 'active-label'}>Voice</span>
              <input type="range" min="0" max="1.5" step="0.1" value={volVoice} onChange={e => setVolVoice(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
              <span>Reverb</span>
              <input type="range" min="0" max="1" step="0.05" value={volReverb} onChange={e => setVolReverb(parseFloat(e.target.value))} />
            </div>
            {/* Click slider removed */}
            <div className="slider-row">
              <span onClick={() => toggleMute('groove', volGroove, setVolGroove)} className={volGroove===0 ? 'muted-label' : 'active-label'}>Groove</span>
              <input type="range" min="0" max="1" step="0.05" value={volGroove} onChange={e => setVolGroove(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
              <span onClick={() => toggleMute('drone', volDrone, setVolDrone)} className={volDrone===0 ? 'muted-label' : 'active-label'}>Drone</span>
              <input type="range" min="0" max="1" step="0.05" value={volDrone} onChange={e => setVolDrone(parseFloat(e.target.value))} />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}