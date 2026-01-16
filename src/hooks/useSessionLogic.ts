import * as Tone from "tone";
import { useState, useRef, useEffect } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { initKeepAlive, updateMediaSessionState, startKeepAlive } from "../audio/KeepAlive";
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator";
import { useAudioSetup } from "./useAudioSetup";
import { useTrainingMode } from "./useTrainingMode";
import { useMixerLogic } from "./useMixerLogic"; // <--- NEW
import { useSessionSettings } from "./useSessionSettings"; // <--- NEW
import { getAvailableDegrees } from "../audio/MusicTheory"; 
import type { MusicalKey, ScaleDegree, MelodyConstraints, ScaleType } from "../types";
import { getFretboardConfig } from "../config/FretboardData";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

export function useSessionLogic() {
  // --- 1. NEW HOOKS ---
  const mixer = useMixerLogic();
  const settings = useSessionSettings();

  // --- 2. CORE SESSION STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState("Start Session");
  const [activeTab, setActiveTab] = useState("random");
  
  // Music Theory State
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  const [visualizerKey, setVisualizerKey] = useState<MusicalKey>("C");
  const [scaleType, setScaleType] = useState<ScaleType>("Major"); 
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);
  const [focusedDegrees, setFocusedDegrees] = useState<ScaleDegree[]>([]);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  
  // Audio Visuals
  const [triggerPulse, setTriggerPulse] = useState(false);
  const [debugClick, setDebugClick] = useState(false);
  const visualTimeoutRef = useRef<number>(0);

  // Logic Refs
  const isPlayingRef = useRef(false);
  const questionCount = useRef(0);
  const activeTabRef = useRef(activeTab);
  const enabledDegreesRef = useRef(enabledDegrees);
  const focusedDegreesRef = useRef(focusedDegrees);
  const currentKeyRef = useRef(currentKey);

  // Training Logic
  const training = useTrainingMode(scaleType);
  const lastPlayedStageIndex = useRef<number>(-1);
  const hasPlayedScalePreview = useRef(false);
  const hasPlayedIntroSequence = useRef(false);

  // --- 3. EFFECTS ---
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);
  useEffect(() => { focusedDegreesRef.current = focusedDegrees; }, [focusedDegrees]);
  useEffect(() => { currentKeyRef.current = currentKey; }, [currentKey]);

  useEffect(() => {
    audioEngine.onStatusChange = (text) => setStatus(text);
    return () => { audioEngine.onStatusChange = null; };
  }, []);

  // Pass mixer/settings values to AudioSetup helper
  useAudioSetup({
    bpm: settings.bpm, 
    volMaster: mixer.volMaster, 
    volGroove: mixer.volGroove, 
    volVoice: mixer.volVoice, 
    volMetronome: mixer.volMetronome, 
    volDrone: mixer.volDrone, 
    debugClick, setTriggerPulse, setActiveMidi, visualTimeoutRef
  });

  // Background Audio Bridge
  useEffect(() => {
    initKeepAlive({
      onPlay: () => startSession(), 
      onPause: () => pauseSession(),
      onNext: () => { if (isPlayingRef.current) runCycle(currentKeyRef.current, false); }
    }); 
  }, []);

  // --- 4. HANDLERS ---
  const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  if (tab === 'fretboard') {
    settings.setInverseMode(true);
    // FIX: Force scale to Pentatonic and update enabled degrees immediately
    const pentatonicType = scaleType === 'Minor' ? 'PentatonicMinor' : 'PentatonicMajor';
    handleScaleChange(pentatonicType); 
  }
};
  const handleScaleChange = (type: ScaleType) => {
    setScaleType(type);
    const defaults = getAvailableDegrees(type);
    setEnabledDegrees(defaults);
    // Force the ref to update immediately for the melody generator
    enabledDegreesRef.current = defaults; 
    setFocusedDegrees([]);
    setFocusedDegrees([]); 
    training.resetTraining();
    
    if (isPlaying) {
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
            setStatus(`${d} Disabled`);
        }
    } else {
        setEnabledDegrees(prev => [...prev, d]);
        setStatus(`${d} Enabled`);
    }
  };

  const toggleFocus = (d: ScaleDegree) => {
    if (activeTab !== 'random') return;

    if (focusedDegrees.includes(d)) {
        setFocusedDegrees(prev => prev.filter(x => x !== d));
        setStatus(`Removed focus: ${d}`);
    } else {
        if (!enabledDegrees.includes(d)) setEnabledDegrees(prev => [...prev, d]);
        setFocusedDegrees(prev => {
            const next = [...prev, d];
            if (next.length > 2) next.shift();
            setStatus(`Focus on ${next.join(" & ")}`);
            return next;
        });
    }
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
          audioEngine.softReset(); 
          training.resetTraining(); 
          training.startTrainingTimer();
          runCycle(currentKey, true); 
      }
  };

  // --- 5. SESSION CONTROLS ---

  const stopSession = () => {
    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = false;
    audioEngine.stopAndKillBridge(); 
    updateMediaSessionState(false);
    training.pauseTrainingTimer(); 
    setStatus("Stopped");
    setActiveMidi(null);
  };

  const pauseSession = () => {
        setIsPlaying(false);
        setIsPaused(true);
        isPlayingRef.current = false;
        audioEngine.pausePlayback();
        setStatus("Paused");
        updateMediaSessionState(false);
    };

  const startSession = async () => {
    if (isPaused) {
        setIsPlaying(true);
        setIsPaused(false);
        isPlayingRef.current = true;
        setStatus("Resuming...");
        await initKeepAlive({ onPlay: () => startSession(), onPause: () => pauseSession() }); 
        updateMediaSessionState(true);
        audioEngine.resumePlayback();
        return;
    }

    if (isPlaying) {
      pauseSession();
      return;
    }

    try {
      setStatus("Initializing...");
      setIsPlaying(true);
      isPlayingRef.current = true;

      await startKeepAlive();
      await audioEngine.init({ 
        groove: mixer.volGroove, voice: mixer.volVoice, click: mixer.volMetronome, 
        master: mixer.volMaster, drone: mixer.volDrone 
      });

      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      
      if (!isPlayingRef.current) return; 
      
      setVisualizerKey(currentKey); 
      await audioEngine.loadBackingTracks(currentKey, ""); 
      audioEngine.setBpm(settings.bpm);
      audioEngine.setDrumPattern(settings.currentPattern);
      audioEngine.setReverbAmt(mixer.volReverb); 

      if (activeTab === 'training') training.startTrainingTimer();
      
      updateMediaSessionState(true);
      runCycle(currentKey, true);

    } catch (e) { 
        console.error(e); 
        setStatus("Error"); 
        stopSession(); 
    }
  };

  // --- 6. GAME LOOP ---
  const runCycle = async (keyToUse: MusicalKey, isFirst = false, startTime?: number) => {
    if (!isPlayingRef.current) return;
    
    setVisualizerKey(keyToUse);
    setActiveMidi(null);
    questionCount.current += 1;
    
    let currentCycleKey = keyToUse;
    let forceOneThreeFive = false;
    let skipPrepareMessage = false;

    // A. Key Changes & Modulation
    if (currentKeyRef.current !== keyToUse) {
        currentCycleKey = currentKeyRef.current;
        setStatus(`Key Change: ${KEY_DISPLAY_MAP[currentCycleKey]}`);
        skipPrepareMessage = true;
        
        if (!isPlayingRef.current) return;
        await audioEngine.loadBackingTracks(currentCycleKey, "");
        if (!isPlayingRef.current) return;
        
        setVisualizerKey(currentCycleKey);
        forceOneThreeFive = true;
        questionCount.current = 1; 
    } 
    // Random Mode Modulation
    else if (activeTabRef.current === 'random' && questionCount.current > settings.refs.questionsPerKey.current) {
        questionCount.current = 1; 
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        
        if (!isPlayingRef.current) return;
        setCurrentKey(newKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[newKey]}...`);
        skipPrepareMessage = true;
        
        await audioEngine.loadBackingTracks(newKey, "");
        if (!isPlayingRef.current) return;

        currentCycleKey = newKey;
        setVisualizerKey(newKey);
        forceOneThreeFive = true;
    }

    // B. Determine Constraints
    let constraints: MelodyConstraints;
    let noteEvents; 
    let playSilent = settings.refs.silentPractice.current; // Use Ref!
    let useTrainingWheels = settings.refs.trainingWheels.current; // Use Ref!

    // Calculate fretboard range if in fretboard mode (used by both training and random)
    let fretboardRange: { min: number; max: number } | undefined;
    if (activeTabRef.current === 'fretboard') {
        const fretConfig = getFretboardConfig(currentCycleKey, scaleType, settings.refs.selectedShape.current);
        const midis = fretConfig.notes.map(n => n.midi);
        fretboardRange = { min: Math.min(...midis), max: Math.max(...midis) };
    }

    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        const stageIndex = config.stageIndex;

        // Training Modulation Check
        const effectiveQuestionsPerKey = config.questionsPerKey || Infinity;
        if (questionCount.current > effectiveQuestionsPerKey) {
            questionCount.current = 1;
            const otherKeys = KEYS.filter(k => k !== keyToUse);
            const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
            setCurrentKey(newKey);
            setStatus(`Level Modulation: ${KEY_DISPLAY_MAP[newKey]}`);
            await audioEngine.loadBackingTracks(newKey, "");
            currentCycleKey = newKey;
        }

        // Auto-Focus for first 4 questions
        if (questionCount.current <= 4 && constraints.allowedDegrees.length > 0) {
            const newestDegree = constraints.allowedDegrees[constraints.allowedDegrees.length - 1];
            constraints.focusedDegrees = [newestDegree];
            setStatus(`Learning: ${newestDegree}`);
        }

        if (config.forceTrainingWheels !== undefined) {
             useTrainingWheels = config.forceTrainingWheels;
             // Update UI to reflect forced state (optional, might need a setter if you want UI to update)
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
             playSilent = settings.refs.silentPractice.current; 
        }
    } else {

    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        const stageIndex = config.stageIndex;

        // Training Modulation Check
        const effectiveQuestionsPerKey = config.questionsPerKey || Infinity;
        if (questionCount.current > effectiveQuestionsPerKey) {
            questionCount.current = 1;
            const otherKeys = KEYS.filter(k => k !== keyToUse);
            const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
            setCurrentKey(newKey);
            setStatus(`Level Modulation: ${KEY_DISPLAY_MAP[newKey]}`);
            await audioEngine.loadBackingTracks(newKey, "");
            currentCycleKey = newKey;
        }

        // Auto-Focus for first 4 questions
        if (questionCount.current <= 4 && constraints.allowedDegrees.length > 0) {
            const newestDegree = constraints.allowedDegrees[constraints.allowedDegrees.length - 1];
            constraints.focusedDegrees = [newestDegree];
            setStatus(`Learning: ${newestDegree}`);
        }

        if (config.forceTrainingWheels !== undefined) {
             useTrainingWheels = config.forceTrainingWheels;
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
             // FIX: Pass the limits to the training melodies too
             noteEvents = generateMelody({ 
                 key: currentCycleKey, 
                 scaleType: scaleType, 
                 constraints: {
                    ...constraints,
                    minMidi: fretboardRange?.min,
                    maxMidi: fretboardRange?.max
                 } 
             });
             playSilent = settings.refs.silentPractice.current; 
        }
    } else {
        // Random Mode Logic
        if (forceOneThreeFive) {
            const pattern: ScaleDegree[] = scaleType === 'Minor' 
                ? ["1", "b3", "5", "1"] 
                : ["1", "3", "5", "1"];

            noteEvents = generateFixedPattern(pattern, currentCycleKey, scaleType);
            setStatus("New Key: Settling In");
            playSilent = settings.refs.silentPractice.current;
        } else {
            constraints = {
                allowedDegrees: enabledDegreesRef.current,
                focusedDegrees: focusedDegreesRef.current, 
                startDegree: settings.refs.startRoot.current ? "1" : undefined,
                endDegree: settings.refs.endRoot.current ? "1" : undefined,     
                length: 4,
                difficulty: settings.refs.difficulty.current,
                minMidi: fretboardRange?.min, 
                maxMidi: fretboardRange?.max  
            };
            playSilent = settings.refs.silentPractice.current;
            noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleType, constraints });
        }
    }
    }


    // C. Schedule & Play
    if (noteEvents && isPlayingRef.current) {
        // Map melody notes to valid vocal sample range (43-67)
        const playableNotes = noteEvents.map(event => {
            let wrappedMidi = event.noteInfo.midi;
            while (wrappedMidi < 43) wrappedMidi += 12;
            while (wrappedMidi > 67) wrappedMidi -= 12;
            
            return {
                ...event,
                noteInfo: {
                    ...event.noteInfo,
                    midi: wrappedMidi // Ensure vocal samples exist for this pitch
                }
            };
        });

        await audioEngine.preloadNotes(playableNotes);
        
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
            startTime,
            skipPrepareMessage,
            settings.refs.inverseMode.current // Use Ref!
        );
        
        if (isFirst) audioEngine.startPlayback();
    }
  };

  return {
    activeTab, setActiveTab: handleTabChange,
    isPlaying, isPaused,
    currentKey, visualizerKey,
    status,
    activeMidi,
    enabledDegrees, toggleDegree,
    focusedDegrees, toggleFocus, 
    triggerPulse,
    debugClick, setDebugClick,
    
    // Spread the new hooks to maintain API compatibility with App.tsx
    ...mixer,
    ...settings,
    
    startSession, stopSession, setKeyManually,
    training, handleLevelChange,
    scaleType, handleScaleChange
  };
}