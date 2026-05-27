import { useEffect, useState, useRef } from "react";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useSessionLogic } from "./hooks/useSessionLogic";
import type { MusicalKey } from "./types";
import "./App.css";

// Components
import Header from "./components/Header/Header";
import Visualizer from "./components/Visualizer/Visualizer";
import FretboardVisualizer from "./components/Visualizer/FretboardVisualizer"; 
import ProgressionsVisualizer from "./components/Visualizer/ProgressionsVisualizer";
import Controls from "./components/Controls/Controls";
import GuidedTutorial from "./components/GuidedTutorial/GuidedTutorial";
import OfflineStatus from "./components/OfflineStatus/OfflineStatus";

// Helper: Convert musical key to MIDI note (using middle C = 60 as reference)
const getKeyRootMidi = (key: MusicalKey): number => {
  const keyToMidi: Record<MusicalKey, number> = {
    "C": 60, "Cs": 61, "D": 62, "Ds": 63, "E": 64, "F": 65,
    "Fs": 66, "G": 67, "Gs": 68, "A": 69, "As": 70, "B": 71
  };
  return keyToMidi[key];
};

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

  // FIX: Determine if we should hide visuals based on mode and status
  const shouldHideVisualizerNotes = 
    // Random tab with inverse + blind mode
    (session.activeTab === 'random' 
      && session.inverseMode 
      && session.hideFretboardVisuals
      && session.status !== 'Answer' 
      && session.status !== 'Affirm')
    ||
    // Fretboard tab with blind mode ON: hide during Listen and Play Along, show during Your Turn
    (session.activeTab === 'fretboard'
      && session.hideFretboardVisuals
      && session.status !== 'Your Turn');

  const shouldHideMovement = 
    // Random tab with inverse + blind mode
    (session.activeTab === 'random' 
      && session.inverseMode 
      && session.hideFretboardVisuals
      && session.status !== 'Answer' 
      && session.status !== 'Affirm')
    ||
    // Fretboard tab with blind mode ON: stop movement during Listen and Play Along
    (session.activeTab === 'fretboard'
      && session.hideFretboardVisuals
      && session.status !== 'Your Turn');

  return (
    <div className="app-container">
      {/* PWA offline-cache status banner */}
      <OfflineStatus />

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
          handleScaleChange={session.handleScaleChange}
          
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

        {/* Status Text (Sing Along / Listen / Play Along / Try It) */}
        <div className="status-text-container">
            {session.status}
        </div>

        {session.activeTab === 'progressions' ? (
          <ProgressionsVisualizer 
            chords={session.currentProgression?.current?.chords || []}
            activeChordIndex={session.activeChordIndex}
            activeRootMidi={session.activeRootMidi}
            hideVisuals={session.hideFretboardVisuals}
            status={session.status}
            viewMode={viewMode}
            scaleType={session.scaleType}
            currentKey={session.currentKey}
            keyRootMidi={getKeyRootMidi(session.currentKey)}
            enabledDegrees={session.enabledDegrees}
            toggleDegree={session.toggleDegree}
            focusedDegrees={session.focusedDegrees}
            toggleFocus={session.toggleFocus}
            includeSevenths={session.includeSevenths}
          />
        ) : session.activeTab === 'fretboard' ? (
          <FretboardVisualizer 
            currentKey={session.currentKey}
            scaleType={session.scaleType}
            selectedShape={session.selectedShape}
            activeMidi={shouldHideVisualizerNotes ? null : session.activeMidi}
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
            volBass={session.volBass}
            setVolBass={session.setVolBass}
            volPiano={session.volPiano}
            setVolPiano={session.setVolPiano}
            toggleMute={toggleMute}
            hideFretboardVisuals={session.hideFretboardVisuals}
            setHideFretboardVisuals={session.setHideFretboardVisuals}
            includeSevenths={session.includeSevenths}
            setIncludeSevenths={session.setIncludeSevenths}
            enabledInversions={session.enabledInversions}
            setEnabledInversions={session.setEnabledInversions}
            playbackSound={session.playbackSound}
            setPlaybackSound={session.setPlaybackSound}
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