import { useState, useEffect, useRef } from "react";
import { audioEngine } from "./audio/AudioEngine";
import { generateMelody, generateFixedPattern } from "./core/MelodyGenerator";
import { getScaleStepsFromRoot } from "./audio/MusicTheory";
import { useTrainingMode } from "./hooks/useTrainingMode"; 
import { useAudioSetup } from "./hooks/useAudioSetup"; 
import type { MusicalKey, ScaleDegree, MelodyConstraints } from "./types";
import "./App.css";

// Components
import Header from "./components/Header/Header";
import Visualizer from "./components/Visualizer/Visualizer";
import Controls from "./components/Controls/Controls";
import TrainingHUD from "./components/TrainingHUD"; 

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
  
  const visualTimeoutRef = useRef<number>(0); 
  useAudioSetup({
    bpm, volMaster, volDrone, volGroove, volVoice, volClick, 
    volReverb, debugClick, volMetronome, 
    setTriggerPulse, setActiveMidi, visualTimeoutRef
  });

  // --- REFS ---
  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  
  const startRootRef = useRef(startRoot);
  const endRootRef = useRef(endRoot);
  const silentPracticeRef = useRef(silentPractice);
  const questionsPerKeyRef = useRef(questionsPerKey);
  const enabledDegreesRef = useRef(enabledDegrees);
  const activeTabRef = useRef(activeTab); 

  // State Tracking for Training Sequences
  const lastPlayedStageIndex = useRef<number>(-1);
  const hasPlayedScalePreview = useRef(false);
  const hasPlayedIntroSequence = useRef(false);

  // Sync Refs
  useEffect(() => { startRootRef.current = startRoot; }, [startRoot]);
  useEffect(() => { endRootRef.current = endRoot; }, [endRoot]);
  useEffect(() => { silentPracticeRef.current = silentPractice; }, [silentPractice]);
  useEffect(() => { questionsPerKeyRef.current = questionsPerKey; }, [questionsPerKey]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

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

  const handleLevelChange = (newLevelId: number) => {
      training.setActiveLevelId(newLevelId);
      lastPlayedStageIndex.current = -1; 
      hasPlayedScalePreview.current = false;
      hasPlayedIntroSequence.current = false;
      
      if (isPlaying) {
          audioEngine.reset(); 
          training.resetTraining(); 
          training.startTrainingTimer();
          runCycle(currentKey, true); 
      }
  };

  const startSession = async () => {
    // FIX: UNLOCK AUDIO IMMEDIATELY (Synchronous)
    audioEngine.prepareAudio();

    if (!isPlaying) {
      try {
        setStatus("Initializing...");
        await audioEngine.init({ drone: volDrone, groove: volGroove, voice: volVoice, click: volClick, master: volMaster });
        audioEngine.setBpm(bpm);
        setStatus("Loading...");
        await audioEngine.loadBackingTracks(currentKey, "groove_1_80bpm.mp3");
        
        setIsPlaying(true);
        isPlayingRef.current = true;
        
        lastPlayedStageIndex.current = -1;
        hasPlayedScalePreview.current = false;
        hasPlayedIntroSequence.current = false;
        
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
    
    // ------------------------------------------------------------------
    // FIX START: Handle Modulation BEFORE generation
    // ------------------------------------------------------------------
    let currentCycleKey = keyToUse;

    if (activeTabRef.current === 'random' && questionCount.current > questionsPerKeyRef.current) {
        questionCount.current = 1; // Reset counter for the new key
        
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        
        // Update state and visuals immediately
        setCurrentKey(newKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[newKey]}...`);
        
        // Wait for audio to load (simulating a pause/transition)
        await audioEngine.loadBackingTracks(newKey, "groove_1_80bpm.mp3");
        await new Promise(r => setTimeout(r, 2000));

        // Use the NEW key for generation in this cycle
        currentCycleKey = newKey;
    }
    // ------------------------------------------------------------------
    // FIX END
    // ------------------------------------------------------------------

    let constraints: MelodyConstraints;
    let noteEvents; 
    let playSilent = false; 

    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        const stageIndex = config.stageIndex;

        setEnabledDegrees(constraints.allowedDegrees);
        setStatus(`${training.stageLabel}`);
        setStartRoot(constraints.startDegree === '1');
        setEndRoot(constraints.endDegree === '1');

        if (stageIndex !== lastPlayedStageIndex.current) {
            lastPlayedStageIndex.current = stageIndex;
            hasPlayedScalePreview.current = false;
            hasPlayedIntroSequence.current = false;
        }

        if (config.scalePreview && !hasPlayedScalePreview.current) {
            noteEvents = generateFixedPattern(config.scalePreview, currentCycleKey, "Major");
            setStatus(`Preview Notes: ${config.scalePreview.join("-")}`);
            hasPlayedScalePreview.current = true; 
        } 
        else if (config.introSequence && !hasPlayedIntroSequence.current) {
            noteEvents = generateFixedPattern(config.introSequence, currentCycleKey, "Major");
            setStatus(`Intro Pattern: ${config.introSequence.join("-")}`);
            hasPlayedIntroSequence.current = true; 
        }
        else {
             noteEvents = generateMelody({
                key: currentCycleKey, 
                scaleType: "Major",
                constraints: constraints
            });
            playSilent = false; 
        }

    } else {
        constraints = {
            allowedDegrees: enabledDegreesRef.current,
            startDegree: startRootRef.current ? "1" : undefined,
            endDegree: endRootRef.current ? "1" : undefined,
            length: 4 
        };
        
        playSilent = silentPracticeRef.current;
        setStatus(playSilent ? "Listen & Repeat" : "Listen");
        
        // Generate melody using the (potentially new) key
        noteEvents = generateMelody({
            key: currentCycleKey, 
            scaleType: "Major",
            constraints: constraints
        });
    }

    await audioEngine.preloadNotes(noteEvents!);
    
    // Schedule and loop, passing the CURRENT key to the next iteration
    // (The next iteration will perform the check at the top to see if it needs to change)
    audioEngine.scheduleRoutine(noteEvents!, playSilent, isFirst, () => {
        if (isPlayingRef.current) runCycle(currentCycleKey, false);
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
          debugClick={debugClick} setDebugClick={setDebugClick}
        />

        {activeTab === 'training' && (
          <TrainingHUD 
            stageLabel={training.stageLabel}
            sessionTime={training.sessionTime}
            userDurationMinutes={training.userDurationMinutes}
            setUserDurationMinutes={training.setUserDurationMinutes}
            activeLevelId={training.activeLevelId}
            setActiveLevelId={training.setActiveLevelId}
            handleLevelChange={handleLevelChange}
          />
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