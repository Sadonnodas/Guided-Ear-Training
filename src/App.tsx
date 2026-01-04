import { useState, useEffect, useRef } from "react";
import { audioEngine } from "./audio/AudioEngine";
import { generateMelody } from "./core/MelodyGenerator";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useTrainingMode } from "./hooks/useTrainingMode"; // NEW IMPORT
import type { MusicalKey, ScaleDegree, MelodyConstraints } from "./types"; // Updated Types
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
  const training = useTrainingMode(); // NEW HOOK

  // --- REFS ---
  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const visualTimeoutRef = useRef<number>(0); 
  
  const startRootRef = useRef(startRoot);
  const endRootRef = useRef(endRoot);
  const silentPracticeRef = useRef(silentPractice);
  const questionsPerKeyRef = useRef(questionsPerKey);
  const enabledDegreesRef = useRef(enabledDegrees);
  const activeTabRef = useRef(activeTab); // Track tab in ref

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

  // RESET training if tab changes
  useEffect(() => {
    if (activeTab === 'random') {
        training.resetTraining();
    }
  }, [activeTab]);

  const toggleDegree = (d: ScaleDegree) => {
    // Only allow toggling in Random Mode
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
        
        // Start Timer if in Training Mode
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
    training.pauseTrainingTimer(); // Pause timer
    setStatus("Paused");
    setActiveMidi(null);
    setLastValidStep(0); 
  };

  const runCycle = async (keyToUse: MusicalKey, isFirst = false) => {
    if (!isPlayingRef.current) return;
    setActiveMidi(null);
    questionCount.current += 1;
    let nextKey = keyToUse;

    // KEY CHANGE LOGIC (Only for Random Mode usually, but keeping simple for now)
    if (questionCount.current > questionsPerKeyRef.current) {
        questionCount.current = 0;
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        nextKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        setCurrentKey(nextKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[nextKey]}...`);
        await audioEngine.loadBackingTracks(nextKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // --- DETERMINE MODE ---
    let constraints: MelodyConstraints;

    if (activeTabRef.current === 'training') {
        // Training Mode Logic
        constraints = training.getCurrentConstraints();
        // Update enabled degrees visually (but user can't click them)
        setEnabledDegrees(constraints.allowedDegrees);
        setStatus(`Level ${training.activeLevelId}: ${training.stageLabel}`);
    } else {
        // Random Mode Logic
        constraints = {
            allowedDegrees: enabledDegreesRef.current,
            startDegree: startRootRef.current ? "1" : undefined,
            endDegree: endRootRef.current ? "1" : undefined,
            length: 4 
        };
        const isSilent = silentPracticeRef.current;
        setStatus(isSilent ? "Listen & Repeat" : "Listen");
    }
    
    // GENERATE
    const melody = generateMelody({
        key: nextKey, 
        scaleType: "Major",
        constraints: constraints
    });
    
    await audioEngine.preloadNotes(melody);
    
    // Use Ref for silent practice in random mode, assume false for training (or add option later)
    const isSilent = activeTabRef.current === 'random' ? silentPracticeRef.current : false;

    audioEngine.scheduleRoutine(melody, isSilent, isFirst, () => {
        if (isPlayingRef.current) runCycle(nextKey, false);
    });
    
    audioEngine.startPlayback();
  };

  // Helper formatting for timer
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
            <div style={{
                textAlign: 'center', 
                marginBottom: '10px', 
                color: 'var(--btn-play)', 
                fontWeight: 'bold',
                background: 'rgba(74, 222, 128, 0.1)',
                padding: '10px',
                borderRadius: '8px'
            }}>
                <div>Time: {formatTime(training.sessionTime)}</div>
                <div style={{fontSize: '0.9em', opacity: 0.8}}>{training.stageLabel}</div>
            </div>
        )}

        <Visualizer 
          viewMode={viewMode}
          activeMidi={activeMidi}
          lastValidStep={lastValidStep}
          enabledDegrees={enabledDegrees}
          toggleDegree={toggleDegree}
        />

        {/* Hide complex controls in training mode to focus user */}
        {activeTab === 'random' ? (
            <Controls 
            isPlaying={isPlaying} onPlayToggle={startSession}
            bpm={bpm} setBpm={setBpm}
            triggerPulse={triggerPulse} 
            
            startRoot={startRoot} setStartRoot={setStartRoot}
            endRoot={endRoot} setEndRoot={setEndRoot}
            silentPractice={silentPractice} setSilentPractice={setSilentPractice}
            questionsPerKey={questionsPerKey} setQuestionsPerKey={setQuestionsPerKey}
            
            volMaster={volMaster} setVolMaster={setVolMaster}
            volVoice={volVoice} setVolVoice={setVolVoice}
            volDrone={volDrone} setVolDrone={setVolDrone}
            volGroove={volGroove} setVolGroove={setVolGroove}
            volReverb={volReverb} setVolReverb={setVolReverb}
            volMetronome={volMetronome} setVolMetronome={setVolMetronome}
            
            toggleMute={toggleMute}
            />
        ) : (
             <div className="play-btn-container">
                <button 
                    className={`play-btn ${isPlaying ? 'playing' : ''}`} 
                    onClick={startSession}
                >
                    {isPlaying ? 
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> 
                        : 
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    }
                </button>
            </div>
        )}

      </div>
    </div>
  );
}