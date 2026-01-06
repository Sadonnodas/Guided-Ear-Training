import { useState, useRef, useEffect } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator";
import { useAudioSetup } from "./useAudioSetup";
import { useTrainingMode } from "./useTrainingMode";
import { getAvailableDegrees } from "../audio/MusicTheory"; 
import type { MusicalKey, ScaleDegree, MelodyConstraints, ScaleType } from "../types";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

export function useSessionLogic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKey, setCurrentKey] = useState<MusicalKey>("C");
  // NEW: Scale Type State
  const [scaleType, setScaleType] = useState<ScaleType>("Major"); 
  
  const [status, setStatus] = useState("Start Session");
  const [bpm, setBpm] = useState(80);
  
  // Track the active pattern so UI defaults match AudioEngine
  const [currentPattern, setCurrentPattern] = useState("Lofi Chill"); 

  const [activeTab, setActiveTab] = useState("random");
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1", "2", "3", "4", "5", "6", "7"]);
  const [startRoot, setStartRoot] = useState(false);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(true);
  const [trainingWheels, setTrainingWheels] = useState(false);
  const [questionsPerKey, setQuestionsPerKey] = useState(10);
  
  // Volumes
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.6); 
  const [volMetronome, setVolMetronome] = useState(0.8);
  const [volTraining, setVolTraining] = useState(0.8); 

  // Visualizer State
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [triggerPulse, setTriggerPulse] = useState(false);
  const [debugClick, setDebugClick] = useState(false);
  const visualTimeoutRef = useRef<number>(0);

  // --- REFS ---
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

  const training = useTrainingMode();
  const lastPlayedStageIndex = useRef<number>(-1);
  const hasPlayedScalePreview = useRef(false);
  const hasPlayedIntroSequence = useRef(false);

  // Sync Refs
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { startRootRef.current = startRoot; }, [startRoot]);
  useEffect(() => { endRootRef.current = endRoot; }, [endRoot]);
  useEffect(() => { questionsPerKeyRef.current = questionsPerKey; }, [questionsPerKey]);
  useEffect(() => { 
      volTrainingRef.current = volTraining; 
      audioEngine.setTrainingVol(volTraining); 
  }, [volTraining]);

  useEffect(() => { trainingWheelsRef.current = trainingWheels; }, [trainingWheels]);
  useEffect(() => { silentPracticeRef.current = silentPractice; }, [silentPractice]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);

  // Bind the status change callback from AudioEngine
  useEffect(() => {
    audioEngine.onStatusChange = (text) => setStatus(text);
    return () => { audioEngine.onStatusChange = null; };
  }, []);

  useAudioSetup({
    bpm, volMaster, volGroove, volVoice, volMetronome, volDrone, 
    debugClick, setTriggerPulse, setActiveMidi, visualTimeoutRef
  });

  // Reset training on tab switch
  useEffect(() => {
    if (activeTab === 'random') training.resetTraining();
  }, [activeTab]);

  // --- ACTIONS ---

  // NEW: Change Scale Type and reset degrees
  const handleScaleChange = (type: ScaleType) => {
    setScaleType(type);
    const defaults = getAvailableDegrees(type);
    setEnabledDegrees(defaults);
    
    if (isPlaying) {
        // FIX: Force reset and restart cycle immediately
        audioEngine.reset();
        runCycle(currentKey, true); // true = treats it as the "First" cycle to restart Transport
    }
  };

  const toggleDegree = (d: ScaleDegree) => {
    if (activeTab !== 'random') return;
    setEnabledDegrees(prev => {
        if (prev.includes(d)) {
            if (prev.length === 1) return prev;
            return prev.filter(x => x !== d);
        }
        return [...prev, d].sort(); // NOTE: simple sort works for basic strings, for chromatic accurate sorting you might need a custom sort function later
    });
  };

  const setPattern = (name: string) => {
    setCurrentPattern(name);
    audioEngine.setDrumPattern(name);
  };

  const setKeyManually = async (k: MusicalKey) => {
    setCurrentKey(k);
    if (isPlaying) {
      setStatus(`Changing to ${KEY_DISPLAY_MAP[k]} next...`);
      questionCount.current = questionsPerKey; 
    } else {
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
          audioEngine.reset(); 
          training.resetTraining(); 
          training.startTrainingTimer();
          runCycle(currentKey, true); 
      }
  };

  const stopSession = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    audioEngine.reset(); 
    training.pauseTrainingTimer(); 
    setStatus("Paused");
    setActiveMidi(null);
  };

  const startSession = async () => {
    if (!isPlaying) {
      try {
        setStatus("Initializing...");
        await audioEngine.init({ 
          groove: volGroove, voice: volVoice, click: volMetronome, 
          master: volMaster, drone: volDrone 
        });
        await audioEngine.loadBackingTracks(currentKey, ""); 
        
        audioEngine.setBpm(bpm);
        // Ensure the pattern is set on start
        audioEngine.setDrumPattern(currentPattern);

        setIsPlaying(true);
        isPlayingRef.current = true;
        
        if (activeTab === 'training') training.startTrainingTimer();
        runCycle(currentKey, true);
      } catch (e) { console.error(e); setStatus("Error"); }
    } else {
      stopSession();
    }
  };

  const runCycle = async (keyToUse: MusicalKey, isFirst = false, startTime?: number) => {
    if (!isPlayingRef.current) return;
    setActiveMidi(null);
    questionCount.current += 1;
    
    let currentCycleKey = keyToUse;
    let forceOneThreeFive = false;

    // --- MODULATION LOGIC ---
    if (activeTabRef.current === 'random' && questionCount.current > questionsPerKeyRef.current) {
        questionCount.current = 1; 
        const otherKeys = KEYS.filter(k => k !== keyToUse); 
        const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        
        setCurrentKey(newKey);
        setStatus(`Modulating to ${KEY_DISPLAY_MAP[newKey]}...`);
        
        await audioEngine.loadBackingTracks(newKey, "");
        currentCycleKey = newKey;
        
        forceOneThreeFive = true;
    }

    let constraints: MelodyConstraints;
    let noteEvents; 
    
    let playSilent = silentPracticeRef.current; 

    // --- GENERATION LOGIC ---
    if (activeTabRef.current === 'training') {
        const config = training.getCurrentConfig();
        constraints = config.constraints;
        const stageIndex = config.stageIndex;

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
             noteEvents = generateMelody({ key: currentCycleKey, scaleType: "Major", constraints });
             playSilent = silentPracticeRef.current; 
        }

    } else {
        // --- RANDOM MODE ---
        if (forceOneThreeFive) {
             // Adjust settling pattern based on scale type
            const pattern: ScaleDegree[] = scaleType === 'Minor' 
            ? ["1", "b3", "5", "1"] 
            : ["1", "3", "5", "1"];

            noteEvents = generateFixedPattern(pattern, currentCycleKey, scaleType);
            setStatus("New Key: Settling In");
            playSilent = silentPracticeRef.current;
        } else {
            constraints = {
                allowedDegrees: enabledDegreesRef.current,
                startDegree: startRootRef.current ? "1" : undefined,
                endDegree: endRootRef.current ? "1" : undefined,
                length: 4 
            };
            playSilent = silentPracticeRef.current;
            // PASS THE SELECTED SCALE TYPE HERE
            noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleType, constraints });
        }
    }

    if (noteEvents) {
        await audioEngine.preloadNotes(noteEvents);
        
        audioEngine.scheduleRoutine(
            noteEvents, 
            playSilent, 
            trainingWheelsRef.current, 
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
    status,
    bpm, setBpm,
    enabledDegrees, toggleDegree,
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

    startSession,
    setKeyManually,
    
    training,
    handleLevelChange,
    
    // EXPOSE NEW PROPS
    scaleType, handleScaleChange
  };
}