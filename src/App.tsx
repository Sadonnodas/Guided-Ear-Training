import { useEffect, useState, useRef } from "react";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useSessionLogic } from "./hooks/useSessionLogic";
import "./App.css";

// Components
import Header from "./components/Header/Header";
import Visualizer from "./components/Visualizer/Visualizer";
import FretboardVisualizer from "./components/Visualizer/FretboardVisualizer"; 
import Controls from "./components/Controls/Controls";
import GuidedTutorial from "./components/GuidedTutorial/GuidedTutorial";

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
        const steps = getScaleStepsFromRoot(session.activeMidi, session.visualizerKey, session.scaleType);
        setLastValidStep(steps);
    }
  }, [session.activeMidi, session.visualizerKey, session.scaleType]);

  // NEW: Update visualizer immediately when level changes in training mode
  useEffect(() => {
    if (session.activeTab === 'training') {
      const config = session.training.getCurrentConfig();
      
      // Update enabled degrees to match level
      session.setEnabledDegrees(config.constraints.allowedDegrees);
      
      // Update focused degrees if level specifies one
      if (config.focusedDegree) {
        session.setFocusedDegrees([config.focusedDegree]);
      } else {
        session.setFocusedDegrees([]);
      }
    }
  }, [session.training.activeLevelId, session.activeTab]);

  // Determine if we should hide visuals in the Visualizer (for Blind Mode in Random tab)
  // In Random tab with inverse mode + blind mode: hide during Listen phases, show during Answer/Affirm
  const shouldHideVisualizerNotes = session.activeTab === 'random' 
    && session.inverseMode 
    && session.hideFretboardVisuals
    && session.status !== 'Answer' 
    && session.status !== 'Affirm';

  // Determine if tape should stop moving (inverse blind mode fix)
  const shouldHideMovement = session.activeTab === 'random' 
    && session.inverseMode 
    && session.hideFretboardVisuals
    && session.status !== 'Answer' 
    && session.status !== 'Affirm';

  return (
    <div className="app-container">
      {/* Guided Tutorial Overlay - Now can control tab changes */}
      <GuidedTutorial 
        onTabChange={session.setActiveTab}
      />

      <div className="main-panel">
        
        <Header 
          activeTab={session.activeTab} 
          setActiveTab={session.setActiveTab}
          currentKey={session.currentKey} 
          setKeyManually={session.setKeyManually}
          viewMode={viewMode} 
          setViewMode={setViewMode}
          scaleType={session.scaleType}
          setScaleType={session.handleScaleChange}
          
          // Training Mode Props
          activeLevelId={session.training.activeLevelId}
          setActiveLevelId={session.training.setActiveLevelId}
          levels={session.training.levels}
          isLevelUnlocked={session.training.isLevelUnlocked}
          
          // Fretboard Props
          selectedShape={session.selectedShape}
          setSelectedShape={session.setSelectedShape}
          
          // NEW: Session control for fretboard mode
          isPlaying={session.isPlaying}
          stopSession={session.stopSession}
        />

        {/* Status Text (Sing Along / Listen) */}
        <div className="status-text-container">
            {session.status}
        </div>

        {session.activeTab === 'fretboard' ? (
          <FretboardVisualizer 
            currentKey={session.currentKey}
            scaleType={session.scaleType}
            selectedShape={session.selectedShape}
            activeMidi={session.activeMidi}
            hideVisuals={session.hideFretboardVisuals}
            status={session.status}
          />
        ) : (
          <Visualizer 
            viewMode={viewMode} 
            activeMidi={shouldHideVisualizerNotes ? null : session.activeMidi}
            lastValidStep={lastValidStep} 
            enabledDegrees={session.enabledDegrees}
            focusedDegrees={session.focusedDegrees} 
            toggleDegree={session.toggleDegree}
            toggleFocus={session.toggleFocus} 
            scaleType={session.scaleType}
            hideMovement={shouldHideMovement}
            activeTab={session.activeTab} // NEW: Pass activeTab for training mode locking
          />
        )}

        <Controls 
            isPlaying={session.isPlaying} 
            isPaused={session.isPaused}
            onPlayToggle={session.startSession}
            onStop={session.stopSession} 
            bpm={session.bpm} 
            setBpm={session.setBpm}
            difficulty={session.difficulty}
            setDifficulty={session.setDifficulty}
            triggerPulse={session.triggerPulse} 
            currentPattern={session.currentPattern}
            setPattern={session.setPattern}
            startRoot={session.startRoot} 
            setStartRoot={session.setStartRoot}
            endRoot={session.endRoot} 
            setEndRoot={session.setEndRoot}
            silentPractice={session.silentPractice} 
            setSilentPractice={session.setSilentPractice}
            trainingWheels={session.trainingWheels} 
            setTrainingWheels={session.setTrainingWheels}
            inverseMode={session.inverseMode} 
            setInverseMode={session.setInverseMode}
            questionsPerKey={session.questionsPerKey} 
            setQuestionsPerKey={session.setQuestionsPerKey}
            debugClick={session.debugClick} 
            setDebugClick={session.setDebugClick}
            volMaster={session.volMaster} 
            setVolMaster={session.setVolMaster}
            volVoice={session.volVoice} 
            setVolVoice={session.setVolVoice}
            volGroove={session.volGroove} 
            setVolGroove={session.setVolGroove}
            volMetronome={session.volMetronome} 
            setVolMetronome={session.setVolMetronome}
            volDrone={session.volDrone} 
            setVolDrone={session.setVolDrone}
            volTraining={session.volTraining} 
            setVolTraining={session.setVolTraining}
            volReverb={session.volReverb} 
            setVolReverb={session.setVolReverb}
            toggleMute={toggleMute}
            hideFretboardVisuals={session.hideFretboardVisuals}
            setHideFretboardVisuals={session.setHideFretboardVisuals}
            activeTab={session.activeTab}
            minVocalMidi={session.minVocalMidi}
            maxVocalMidi={session.maxVocalMidi}
            setMinVocalMidi={session.setMinVocalMidi}
            setMaxVocalMidi={session.setMaxVocalMidi}
        />
      </div>
    </div>
  );
}