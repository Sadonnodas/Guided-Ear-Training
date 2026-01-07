import { useState, useRef, useEffect } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { initKeepAlive, updateMediaSessionState } from "../audio/KeepAlive"; // New
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator";
import { useAudioSetup } from "./useAudioSetup";
import { useTrainingMode } from "./useTrainingMode";
import { getAvailableDegrees } from "../audio/MusicTheory"; 
import type { MusicalKey, ScaleDegree, MelodyConstraints, ScaleType, MelodyDifficulty } from "../types";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

export function useSessionLogic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  const [visualizerKey, setVisualizerKey] = useState<MusicalKey>("C");

  const [scaleType, setScaleType] = useState<ScaleType>("Major"); 
  const [status, setStatus] = useState("Start Session");
  const [bpm, setBpm] = useState(80);
  const [currentPattern, setCurrentPattern] = useState("Lofi Chill"); 
  const [activeTab, setActiveTab] = useState("random");

  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);
  const [focusedDegrees, setFocusedDegrees] = useState<ScaleDegree[]>([]);

  const [startRoot, setStartRoot] = useState(false);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(true);
  const [trainingWheels, setTrainingWheels] = useState(false);
  const [questionsPerKey, setQuestionsPerKey] = useState(10);
  const [difficulty, setDifficulty] = useState<MelodyDifficulty>("normal"); //
  
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.6); 
  const [volMetronome, setVolMetronome] = useState(0.8);
  const [volTraining, setVolTraining] = useState(0.8); 
  const [volReverb, setVolReverb] = useState(0.3); 

  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [triggerPulse, setTriggerPulse] = useState(false);
  const [debugClick, setDebugClick] = useState(false);
  const visualTimeoutRef = useRef<number>(0);

  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const activeTabRef = useRef(activeTab);
  const startRootRef = useRef(startRoot);
  const endRootRef = useRef(endRoot);
  const questionsPerKeyRef = useRef(questionsPerKey);
  const volTrainingRef = useRef(volTraining);
  const trainingWheelsRef = useRef(trainingWheels);
  const silentPracticeRef = useRef(silentPractice);
  const enabledDegreesRef = useRef(enabledDegrees);
  const focusedDegreesRef = useRef(focusedDegrees);
  
  // FIX: Track manual key changes
  const currentKeyRef = useRef(currentKey);

  const training = useTrainingMode(scaleType);
  const lastPlayedStageIndex = useRef<number>(-1);
  const hasPlayedScalePreview = useRef(false);
  const hasPlayedIntroSequence = useRef(false);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { startRootRef.current = startRoot; }, [startRoot]);
  useEffect(() => { endRootRef.current = endRoot; }, [endRoot]);
  useEffect(() => { questionsPerKeyRef.current = questionsPerKey; }, [questionsPerKey]);
  useEffect(() => { volTrainingRef.current = volTraining; audioEngine.setTrainingVol(volTraining); }, [volTraining]);
  useEffect(() => { trainingWheelsRef.current = trainingWheels; }, [trainingWheels]);
  useEffect(() => { silentPracticeRef.current = silentPractice; }, [silentPractice]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);
  useEffect(() => { focusedDegreesRef.current = focusedDegrees; }, [focusedDegrees]);
  useEffect(() => { currentKeyRef.current = currentKey; }, [currentKey]);
  useEffect(() => { audioEngine.setReverbAmt(volReverb); }, [volReverb]);

  useEffect(() => {
    audioEngine.onStatusChange = (text) => setStatus(text);
    return () => { audioEngine.onStatusChange = null; };
  }, []);

  useAudioSetup({
    bpm, volMaster, volGroove, volVoice, volMetronome, volDrone, 
    debugClick, setTriggerPulse, setActiveMidi, visualTimeoutRef
  });

  // Initialize the background bridge and link it to startSession
  useEffect(() => {
  initKeepAlive(() => startSession()); // Connect lock screen to your logic
}, []);

  const handleScaleChange = (type: ScaleType) => {
    setScaleType(type);
    const defaults = getAvailableDegrees(type);
    setEnabledDegrees(defaults);
    setFocusedDegrees([]); 
    training.resetTraining();
    
    if (isPlaying) {
        // Use softReset to change music without killing the background bridge
        audioEngine.softReset();
        runCycle(currentKey, true); 
    }
  };

  const toggleDegree = (d: ScaleDegree) => {
    if (activeTab !== 'random') return;

    if (enabledDegrees.includes(d)) {
        if (enabledDegrees.length > 1) {
            setEnabledDegrees(prev => prev.filter(x => x !== d));
            setFocusedDegrees(prev => prev.filter(x => x !== d));
        }
    } else {
        setEnabledDegrees(prev => [...prev, d]); 
    }
  };

  const toggleFocus = (d: ScaleDegree) => {
    if (activeTab !== 'random') return;

    if (focusedDegrees.includes(d)) {
        setFocusedDegrees(prev => prev.filter(x => x !== d));
    } else {
        if (!enabledDegrees.includes(d)) {
            setEnabledDegrees(prev => [...prev, d]);
        }
        setFocusedDegrees(prev => {
            const next = [...prev, d];
            if (next.length > 2) next.shift(); 
            return next;
        });
    }
  };

  const setPattern = (name: string) => {
    setCurrentPattern(name);
    audioEngine.setDrumPattern(name);
  };

  const setKeyManually = async (k: MusicalKey) => {
    setCurrentKey(k);
    if (isPlaying) {
      setStatus(`Changing to ${KEY_DISPLAY_MAP[k]} next...`);
    } else {
      setVisualizerKey(k);
      setStatus(`Key: ${KEY_DISPLAY_MAP[k]}`);
      await audioEngine.loadBackingTracks(k, "");
    }
  };

  const handleLevelChange = (newLevelId: number) => {
      training.setActiveLevelId(newLevelId);
      lastPlayedStageIndex.current = -1; 
      hasPlayedScalePreview.current = false;
      hasPlayedIntroSequence.current = false;
      
      if (isPlaying) {
          // Use softReset to keep the pocket mode alive during level changes
          audioEngine.softReset(); 
          training.resetTraining(); 
          training.startTrainingTimer();
          runCycle(currentKey, true); 
      }
  };

  const stopSession = () => {
    setIsPlaying(false);
    isPlayingRef.current = false; 
    
    // Stop the music AND the background process
    audioEngine.stopAndKillBridge(); 
    
    // Update lock screen icon to "Play"
    updateMediaSessionState(false);

    training.pauseTrainingTimer(); 
    setStatus("Paused");
    setActiveMidi(null);
  };

  const startSession = async () => {
    if (!isPlaying) {
      try {
        setStatus("Initializing...");
        setIsPlaying(true);
        isPlayingRef.current = true;

        await audioEngine.init({ 
          groove: volGroove, voice: volVoice, click: volMetronome, 
          master: volMaster, drone: volDrone 
        });
        
        if (!isPlayingRef.current) return; 
        
        // 1. Initialize metadata immediately (don't await)
        initKeepAlive(() => {
          if (isPlayingRef.current) stopSession(); else startSession();
        });

        setVisualizerKey(currentKey); 

        // 2. Load the actual music assets
        await audioEngine.loadBackingTracks(currentKey, ""); 
        audioEngine.setBpm(bpm);
        audioEngine.setDrumPattern(currentPattern);
        audioEngine.setReverbAmt(volReverb); 

        if (activeTab === 'training') training.startTrainingTimer();
        
        // 3. Update the Lock Screen UI State
        updateMediaSessionState(true);

        // 4. Start the Music (The runCycle calls startPlayback internally)
        runCycle(currentKey, true);

      } catch (e) { 
          console.error(e); 
          setStatus("Error"); 
          stopSession(); 
      }
    } else {
      stopSession();
    }
  };

  const runCycle = async (keyToUse: MusicalKey, isFirst = false, startTime?: number) => {
    if (!isPlayingRef.current) return;
    
    setVisualizerKey(keyToUse);

    setActiveMidi(null);
    questionCount.current += 1;
    
    let currentCycleKey = keyToUse;
    let forceOneThreeFive = false;

    // --- MODULATION LOGIC ---
    if (currentKeyRef.current !== keyToUse) {
        currentCycleKey = currentKeyRef.current;
        setStatus(`Key Change: ${KEY_DISPLAY_MAP[currentCycleKey]}`);
        
        if (!isPlayingRef.current) return;
        await audioEngine.loadBackingTracks(currentCycleKey, "");
        if (!isPlayingRef.current) return;
        
        setVisualizerKey(currentCycleKey);
        forceOneThreeFive = true;
        questionCount.current = 1; 
    } 
    else if (activeTabRef.current === 'random' && questionCount.current > questionsPerKeyRef.current) {
        questionCount.current = 1; 
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        
        if (!isPlayingRef.current) return;

        setCurrentKey(newKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[newKey]}...`);
        
        await audioEngine.loadBackingTracks(newKey, "");
        if (!isPlayingRef.current) return;

        currentCycleKey = newKey;
        setVisualizerKey(newKey);
        forceOneThreeFive = true;
    }

    let constraints: MelodyConstraints;
    let noteEvents; 
    let playSilent = silentPracticeRef.current; 
    let useTrainingWheels = trainingWheelsRef.current; 

    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        const stageIndex = config.stageIndex;

        if (config.forceTrainingWheels !== undefined) {
             useTrainingWheels = config.forceTrainingWheels;
             setTrainingWheels(config.forceTrainingWheels); 
        }

        setEnabledDegrees(constraints.allowedDegrees);

        if (stageIndex !== lastPlayedStageIndex.current) {
            lastPlayedStageIndex.current = stageIndex;
            hasPlayedScalePreview.current = false;
            hasPlayedIntroSequence.current = false;
        }

        if (config.scalePreview && !hasPlayedScalePreview.current) {
            noteEvents = generateFixedPattern(config.scalePreview, currentCycleKey, "Major"); 
            hasPlayedScalePreview.current = true; 
        } 
        else if (config.introSequence && !hasPlayedIntroSequence.current) {
            noteEvents = generateFixedPattern(config.introSequence, currentCycleKey, "Major");
            hasPlayedIntroSequence.current = true; 
        }
        else {
             noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleType, constraints });
             playSilent = silentPracticeRef.current; 
        }

    } else {
        if (forceOneThreeFive) {
            const pattern: ScaleDegree[] = scaleType === 'Minor' 
                ? ["1", "b3", "5", "1"] 
                : ["1", "3", "5", "1"];

            noteEvents = generateFixedPattern(pattern, currentCycleKey, scaleType);
            setStatus("New Key: Settling In");
            playSilent = silentPracticeRef.current;
        } else {
            constraints = {
                allowedDegrees: enabledDegreesRef.current,
                focusedDegrees: focusedDegreesRef.current, 
                startDegree: startRootRef.current ? "1" : undefined,
                endDegree: endRootRef.current ? "1" : undefined,
                length: 4,
                difficulty: difficulty // Pass the state value here
            };
            playSilent = silentPracticeRef.current;
            noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleType, constraints });
        }
    }

    if (noteEvents && isPlayingRef.current) {
        await audioEngine.preloadNotes(noteEvents);
        
        if (!isPlayingRef.current) return;

        audioEngine.scheduleRoutine(
            noteEvents, 
            playSilent, 
            useTrainingWheels, 
            isFirst, 
            (nextStartTime) => {
                if (isPlayingRef.current) {
                    runCycle(currentCycleKey, false, nextStartTime);
                }
            },
            startTime
        );
        
        if (isFirst) audioEngine.startPlayback();
    }
  };

  return {
    activeTab, setActiveTab,
    isPlaying,
    currentKey, 
    visualizerKey,
    status,
    bpm, setBpm,
    enabledDegrees, toggleDegree,
    focusedDegrees, toggleFocus, 
    activeMidi,
    triggerPulse,
    debugClick, setDebugClick,
    currentPattern, setPattern,
    startRoot, setStartRoot,
    endRoot, setEndRoot,
    silentPractice, setSilentPractice,
    trainingWheels, setTrainingWheels,
    questionsPerKey, setQuestionsPerKey,
    volMaster, setVolMaster,
    volVoice, setVolVoice,
    volDrone, setVolDrone,
    volGroove, setVolGroove,
    volMetronome, setVolMetronome,
    volTraining, setVolTraining,
    volReverb, setVolReverb,
    difficulty,     // Add this
    setDifficulty, 
    startSession,
    setKeyManually,
    training,
    handleLevelChange,
    scaleType, handleScaleChange
  };
}