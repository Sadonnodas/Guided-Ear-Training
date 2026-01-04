import { useState, useEffect, useRef } from "react";
import { audioEngine } from "./audio/AudioEngine";
import { generateMelody } from "./core/MelodyGenerator";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import type { MusicalKey, ScaleDegree } from "./types";
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
  // --- STATE ---
  const [activeTab, setActiveTab] = useState("random");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  const [status, setStatus] = useState("Start Session");
  const [viewMode, setViewMode] = useState<'tape' | 'static'>('tape');
  
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [lastValidStep, setLastValidStep] = useState(0); 
  
  const [bpm, setBpm] = useState(80);
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);
  
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.5);
  const [volClick] = useState(0.5); 
  const [volReverb, setVolReverb] = useState(0.3);

  const prevVol = useRef<Record<string, number>>({});
  const [startRoot, setStartRoot] = useState(false);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(false);

  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const visualTimeoutRef = useRef<number>(0); 

  // --- AUDIO EFFECTS & ENGINE SYNC ---
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
    audioEngine.setMasterVol(volMaster);
    audioEngine.setDroneVol(volDrone);
    audioEngine.setDrumVol(volGroove);
    audioEngine.setVocalVol(volVoice);
    audioEngine.setClickVol(volClick);
    audioEngine.setReverbMix(volReverb);
    audioEngine.setBpm(bpm);
  }, [volMaster, volDrone, volGroove, volVoice, volClick, volReverb, bpm]);

  useEffect(() => {
    if (activeMidi !== null) {
        const steps = getScaleStepsFromRoot(activeMidi, currentKey, "Major");
        setLastValidStep(steps);
    }
  }, [activeMidi, currentKey]);

  // --- ACTIONS ---
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
    const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
    setKeyManually(newKey);
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
        await audioEngine.init({ drone: volDrone, groove: volGroove, voice: volVoice, click: volClick, master: volMaster });
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
    setActiveMidi(null);
    setLastValidStep(0); 
  };

  const runCycle = async (keyToUse: MusicalKey) => {
    if (!isPlayingRef.current) return;
    setActiveMidi(null);
    questionCount.current += 1;
    let nextKey = keyToUse;

    if (questionCount.current > 10) {
        questionCount.current = 0;
        const otherKeys = KEYS.filter(k => k !== currentKey);
        nextKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        setCurrentKey(nextKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[nextKey]}...`);
        await audioEngine.loadBackingTracks(nextKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 2000));
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
        if (isPlayingRef.current) runCycle(currentKey);
    });
    audioEngine.startPlayback();
  };

  return (
    <div className="app-container">
      <div className="main-panel">
        
        <Header 
          activeTab={activeTab} setActiveTab={setActiveTab}
          currentKey={currentKey} setKeyManually={setKeyManually}
          pickRandomKey={pickRandomKey} status={status}
          viewMode={viewMode} setViewMode={setViewMode}
        />

        <Visualizer 
          viewMode={viewMode}
          activeMidi={activeMidi}
          lastValidStep={lastValidStep}
          enabledDegrees={enabledDegrees}
          toggleDegree={toggleDegree}
        />

        <Controls 
          isPlaying={isPlaying} onPlayToggle={startSession}
          bpm={bpm} setBpm={setBpm}
          startRoot={startRoot} setStartRoot={setStartRoot}
          endRoot={endRoot} setEndRoot={setEndRoot}
          silentPractice={silentPractice} setSilentPractice={setSilentPractice}
          volMaster={volMaster} setVolMaster={setVolMaster}
          volVoice={volVoice} setVolVoice={setVolVoice}
          volDrone={volDrone} setVolDrone={setVolDrone}
          volGroove={volGroove} setVolGroove={setVolGroove}
          volReverb={volReverb} setVolReverb={setVolReverb}
          toggleMute={toggleMute}
        />

      </div>
    </div>
  );
}