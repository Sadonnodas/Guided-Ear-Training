import { useState, useEffect, useRef } from "react";
import { audioEngine } from "./audio/AudioEngine";
import { generateMelody } from "./core/MelodyGenerator";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useTrainingMode } from "./hooks/useTrainingMode"; 
import { MAJOR_LEVELS } from "./config/TrainingLevels"; 
import type { MusicalKey, ScaleDegree, MelodyConstraints } from "./types";
import "./App.css";

// Components
import Header from "./components/Header/Header";
import Visualizer from "./components/Visualizer/Visualizer";
import Controls from "./components/Controls/Controls";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

export default function App() {
  const [activeTab, setActiveTab] = useState("random");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  const [status, setStatus] = useState("Start Session");
  const [viewMode, setViewMode] = useState<'tape' | 'static'>('tape');
  
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [lastValidStep, setLastValidStep] = useState(0); 
  
  const [bpm, setBpm] = useState(80);
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);
  
  // Volume State
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.5);
  const [volClick] = useState(0.5); 
  const [volReverb, setVolReverb] = useState(0.3);
  const [volMetronome, setVolMetronome] = useState(0.8);

  const prevVol = useRef<Record<string, number>>({});
  
  // Settings (Random Mode)
  const [startRoot, setStartRoot] = useState(false);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(false);
  const [questionsPerKey, setQuestionsPerKey] = useState(10); 
  const [triggerPulse, setTriggerPulse] = useState(false);
  const [debugClick, setDebugClick] = useState(false); 

  // --- HOOKS ---
  const training = useTrainingMode(); 

  // --- REFS ---
  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const visualTimeoutRef = useRef<number>(0); 
  
  const startRootRef = useRef(startRoot);
  const endRootRef = useRef(endRoot);
  const silentPracticeRef = useRef(silentPractice);
  const questionsPerKeyRef = useRef(questionsPerKey);
  const enabledDegreesRef = useRef(enabledDegrees);
  const activeTabRef = useRef(activeTab); 

  // Sync Refs
  useEffect(() => { startRootRef.current = startRoot; }, [startRoot]);
  useEffect(() => { endRootRef.current = endRoot; }, [endRoot]);
  useEffect(() => { silentPracticeRef.current = silentPractice; }, [silentPractice]);
  useEffect(() => { questionsPerKeyRef.current = questionsPerKey; }, [questionsPerKey]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    audioEngine.onNotePlay = (note, isClick) => {
      if (isClick) return; 
      if (note) {
        setActiveMidi(note.noteInfo.midi);
        if (visualTimeoutRef.current) clearTimeout(visualTimeoutRef.current);
        const secPerBeat = 60 / bpm; 
        const holdTime = (note.duration * secPerBeat * 1000) - 50; 
        visualTimeoutRef.current = setTimeout(() => setActiveMidi(null), holdTime);
      }
    };
    audioEngine.onBeat = (_) => { setTriggerPulse(p => !p); };

    audioEngine.setMasterVol(volMaster);
    audioEngine.setDroneVol(volDrone);
    audioEngine.setDrumVol(volGroove);
    audioEngine.setVocalVol(volVoice);
    audioEngine.setClickVol(volClick);
    audioEngine.setReverbMix(volReverb);
    audioEngine.setBpm(bpm);
    audioEngine.setDebugClick(debugClick);
    audioEngine.setMetronomeVol(volMetronome);

  }, [volMaster, volDrone, volGroove, volVoice, volClick, volReverb, bpm, debugClick, volMetronome]);

  useEffect(() => {
    if (activeMidi !== null) {
        const steps = getScaleStepsFromRoot(activeMidi, currentKey, "Major");
        setLastValidStep(steps);
    }
  }, [activeMidi, currentKey]);

  useEffect(() => {
    if (activeTab === 'random') {
        training.resetTraining();
    }
  }, [activeTab]);

  const toggleDegree = (d: ScaleDegree) => {
    if (activeTab !== 'random') return;
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
    const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
    setKeyManually(newKey);
  };

  const setKeyManually = async (k: MusicalKey) => {
    setCurrentKey(k);
    if (isPlaying) {
      setStatus(`Changing to ${KEY_DISPLAY_MAP[k]} next...`);
      questionCount.current = questionsPerKey; 
    } else {
      setStatus(`Key: ${KEY_DISPLAY_MAP[k]}`);
      await audioEngine.loadBackingTracks(k, "groove_1_80bpm.mp3");
    }
  };

  // --- NEW: Safe Level Switching ---
  const handleLevelChange = (newLevelId: number) => {
      training.setActiveLevelId(newLevelId);
      
      // If playing, we must RESTART the session to:
      // 1. Kill the old loop (prevents double audio)
      // 2. Apply new level immediately (prevents stale constraints)
      if (isPlaying) {
          audioEngine.reset(); // Stop Transport & Clear Schedules
          training.resetTraining(); // Reset Timer
          training.startTrainingTimer();
          runCycle(currentKey, true); // Force new start
      }
  };

  const startSession = async () => {
    if (!isPlaying) {
      try {
        setStatus("Initializing...");
        await audioEngine.init({ drone: volDrone, groove: volGroove, voice: volVoice, click: volClick, master: volMaster });
        audioEngine.setBpm(bpm);
        setStatus("Loading...");
        await audioEngine.loadBackingTracks(currentKey, "groove_1_80bpm.mp3");
        
        setIsPlaying(true);
        isPlayingRef.current = true;
        
        if (activeTab === 'training') {
            training.startTrainingTimer();
        }

        runCycle(currentKey, true);
      } catch (e) { console.error(e); setStatus("Error"); }
    } else {
      stopSession();
    }
  };

  const stopSession = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    audioEngine.reset(); 
    training.pauseTrainingTimer(); 
    setStatus("Paused");
    setActiveMidi(null);
    setLastValidStep(0); 
  };

  const runCycle = async (keyToUse: MusicalKey, isFirst = false) => {
    if (!isPlayingRef.current) return;
    setActiveMidi(null);
    questionCount.current += 1;
    let nextKey = keyToUse;

    // --- DETERMINE MODE & CONFIG ---
    let constraints: MelodyConstraints;
    let limitForModulation = 9999;

    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        limitForModulation = config.questionsPerKey;

        setEnabledDegrees(constraints.allowedDegrees);
        setStatus(`${training.stageLabel}`);
        setStartRoot(constraints.startDegree === '1');
        setEndRoot(constraints.endDegree === '1');
    } else {
        constraints = {
            allowedDegrees: enabledDegreesRef.current,
            startDegree: startRootRef.current ? "1" : undefined,
            endDegree: endRootRef.current ? "1" : undefined,
            length: 4 
        };
        limitForModulation = questionsPerKeyRef.current; 
        const isSilent = silentPracticeRef.current;
        setStatus(isSilent ? "Listen & Repeat" : "Listen");
    }

    // --- MODULATION LOGIC ---
    if (questionCount.current > limitForModulation) {
        questionCount.current = 0;
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        nextKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        setCurrentKey(nextKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[nextKey]}...`);
        await audioEngine.loadBackingTracks(nextKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // GENERATE
    const melody = generateMelody({
        key: nextKey, 
        scaleType: "Major",
        constraints: constraints
    });
    
    await audioEngine.preloadNotes(melody);
    
    const isSilent = activeTabRef.current === 'random' ? silentPracticeRef.current : false;

    audioEngine.scheduleRoutine(melody, isSilent, isFirst, () => {
        if (isPlayingRef.current) runCycle(nextKey, false);
    });
    
    audioEngine.startPlayback();
  };

  const formatTime = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      <div className="main-panel">
        
        <Header 
          activeTab={activeTab} setActiveTab={setActiveTab}
          currentKey={currentKey} setKeyManually={setKeyManually}
          pickRandomKey={pickRandomKey} status={status}
          viewMode={viewMode} setViewMode={setViewMode}
          debugClick={debugClick} setDebugClick={setDebugClick}
        />

        {/* TRAINING HUD */}
        {activeTab === 'training' && (
            <div className="training-hud">
                <div className="training-info">
                   <div style={{fontWeight:'bold'}}>{training.stageLabel}</div>
                   <div style={{fontSize: '0.9em', opacity: 0.8}}>
                       {formatTime(training.sessionTime)} / {training.userDurationMinutes}:00
                   </div>
                </div>
                
                {/* LEVEL SELECTOR: Now uses handleLevelChange */}
                <div style={{display:'flex', gap:'10px', marginTop:'10px', justifyContent:'center'}}>
                   <select 
                     value={training.activeLevelId} 
                     onChange={(e) => handleLevelChange(Number(e.target.value))}
                     className="key-select"
                     style={{width: '100%'}}
                   >
                       {MAJOR_LEVELS.map(l => (
                           <option key={l.id} value={l.id}>{l.name}</option>
                       ))}
                   </select>
                </div>
                
                <div className="slider-row" style={{marginTop: '15px'}}>
                    <span>Duration: {training.userDurationMinutes}m</span>
                    <input 
                        type="range" min="1" max="20" step="1"
                        value={training.userDurationMinutes}
                        onChange={(e) => training.setUserDurationMinutes(Number(e.target.value))}
                    />
                </div>
            </div>
        )}

        <Visualizer 
          viewMode={viewMode}
          activeMidi={activeMidi}
          lastValidStep={lastValidStep}
          enabledDegrees={enabledDegrees}
          toggleDegree={toggleDegree}
        />

        <div style={{ opacity: activeTab === 'training' ? 1 : 1 }}>
            <Controls 
                isPlaying={isPlaying} onPlayToggle={startSession}
                bpm={bpm} setBpm={setBpm}
                triggerPulse={triggerPulse} 
                
                startRoot={startRoot} setStartRoot={activeTab === 'random' ? setStartRoot : () => {}}
                endRoot={endRoot} setEndRoot={activeTab === 'random' ? setEndRoot : () => {}}
                silentPractice={silentPractice} setSilentPractice={activeTab === 'random' ? setSilentPractice : () => {}}
                questionsPerKey={questionsPerKey} setQuestionsPerKey={activeTab === 'random' ? setQuestionsPerKey : () => {}}
                
                volMaster={volMaster} setVolMaster={setVolMaster}
                volVoice={volVoice} setVolVoice={setVolVoice}
                volDrone={volDrone} setVolDrone={setVolDrone}
                volGroove={volGroove} setVolGroove={setVolGroove}
                volReverb={volReverb} setVolReverb={setVolReverb}
                volMetronome={volMetronome} setVolMetronome={setVolMetronome}
                
                toggleMute={toggleMute}
            />
            {activeTab === 'training' && (
                <div style={{textAlign:'center', fontSize:'0.75em', opacity:0.5, marginTop:'5px'}}>
                    * Some settings are managed by the Level
                </div>
            )}
        </div>

      </div>
    </div>
  );
}