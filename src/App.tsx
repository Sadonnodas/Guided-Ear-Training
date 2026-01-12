import { useEffect, useState, useRef } from "react";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useSessionLogic } from "./hooks/useSessionLogic";
import type { MusicalKey } from "./types";
import "./App.css";

// Components
import Header from "./components/Header/Header";
import Visualizer from "./components/Visualizer/Visualizer";
import Controls from "./components/Controls/Controls";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];

export default function App() {
  const session = useSessionLogic();
  
  const [viewMode, setViewMode] = useState<'tape' | 'static'>('tape');
  const [lastValidStep, setLastValidStep] = useState(0); 

  // Volume Mute Helper
  const prevVol = useRef<Record<string, number>>({});
  const toggleMute = (type: string, val: number, setter: (v: number) => void) => {
    if (val > 0) {
        prevVol.current[type] = val;
        setter(0);
    } else {
        setter(prevVol.current[type] || 0.5);
    }
  };

  useEffect(() => {
    if (session.activeMidi !== null) {
        // FIX: Use session.visualizerKey here to prevent visual mismatch during key changes
        const steps = getScaleStepsFromRoot(session.activeMidi, session.visualizerKey, session.scaleType);
        setLastValidStep(steps);
    }
  }, [session.activeMidi, session.visualizerKey, session.scaleType]);

  return (
    <div className="app-container">
      <div className="main-panel">
        
        <Header 
          activeTab={session.activeTab} setActiveTab={session.setActiveTab}
          currentKey={session.currentKey} setKeyManually={session.setKeyManually}
          pickRandomKey={() => session.setKeyManually(KEYS[Math.floor(Math.random() * KEYS.length)])} 
          viewMode={viewMode} setViewMode={setViewMode}
          debugClick={session.debugClick} setDebugClick={session.setDebugClick}
          scaleType={session.scaleType}
          setScaleType={session.handleScaleChange}
          
          activeLevelId={session.training.activeLevelId}
          setActiveLevelId={session.training.setActiveLevelId}
          levels={session.training.levels}
        />

        {/* Status Text (Sing Along / Listen) */}
        <div className="status-text-container">
            {session.status}
        </div>

        <Visualizer 
          viewMode={viewMode} activeMidi={session.activeMidi}
          lastValidStep={lastValidStep} 
          enabledDegrees={session.enabledDegrees}
          focusedDegrees={session.focusedDegrees} 
          toggleDegree={session.toggleDegree}
          toggleFocus={session.toggleFocus} 
          scaleType={session.scaleType}
        />

        <Controls 
            isPlaying={session.isPlaying} 
            isPaused={session.isPaused} // Add this line
            onPlayToggle={session.startSession}
            onStop={session.stopSession} 
            bpm={session.bpm} setBpm={session.setBpm}
            difficulty={session.difficulty}
            setDifficulty={session.setDifficulty}
            triggerPulse={session.triggerPulse} 
            currentPattern={session.currentPattern}
            setPattern={session.setPattern}
            startRoot={session.startRoot} setStartRoot={session.setStartRoot}
            endRoot={session.endRoot} setEndRoot={session.setEndRoot}
            silentPractice={session.silentPractice} setSilentPractice={session.setSilentPractice}
            trainingWheels={session.trainingWheels} setTrainingWheels={session.setTrainingWheels}
            inverseMode={session.inverseMode} setInverseMode={session.setInverseMode} // Updated to inverseMode
            questionsPerKey={session.questionsPerKey} setQuestionsPerKey={session.setQuestionsPerKey}
            volMaster={session.volMaster} setVolMaster={session.setVolMaster}
            volVoice={session.volVoice} setVolVoice={session.setVolVoice}
            volGroove={session.volGroove} setVolGroove={session.setVolGroove}
            volMetronome={session.volMetronome} setVolMetronome={session.setVolMetronome}
            volDrone={session.volDrone} setVolDrone={session.setVolDrone}
            volTraining={session.volTraining} setVolTraining={session.setVolTraining}
            volReverb={session.volReverb} setVolReverb={session.setVolReverb}
            toggleMute={toggleMute}
        />
      </div>
    </div>
  );
}