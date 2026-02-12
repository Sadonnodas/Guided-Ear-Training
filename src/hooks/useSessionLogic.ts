import * as Tone from "tone";
import { useState, useRef, useEffect, useCallback } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { initKeepAlive, updateMediaSessionState, startKeepAlive } from "../audio/KeepAlive";
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator";
import { 
  generateChordProgression, 
  generateModulationProgression,
  getChordMidiNotes,
  type ChordProgression
} from "../core/ChordProgressionGenerator";
import { useAudioSetup } from "./useAudioSetup";
import { useTrainingMode } from "./useTrainingMode";
import { useMixerLogic } from "./useMixerLogic";
import { useSessionSettings } from "./useSessionSettings";
import { getAvailableDegrees } from "../audio/MusicTheory"; 
import { LATENCY_OFFSET } from "../config/AudioConfig"; // NEW: Import timing offsets
import type { MusicalKey, ScaleDegree, MelodyConstraints, ScaleType } from "../types";
import { getFretboardConfig } from "../config/FretboardData";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C", "Cs": "D♭", "D": "D", "Ds": "E♭", "E": "E", "F": "F",
  "Fs": "F♯", "G": "G", "Gs": "A♭", "A": "A", "As": "B♭", "B": "B"
};

// Default settings per tab (used for reset on tab switch)
const TAB_DEFAULTS: Record<string, {
  inverseMode: boolean;
  trainingWheels: boolean;
  hideFretboardVisuals: boolean;
}> = {
  random: {
    inverseMode: false,
    trainingWheels: false,
    hideFretboardVisuals: false
  },
  training: {
    inverseMode: false,
    trainingWheels: false,
    hideFretboardVisuals: false
  },
  fretboard: {
    inverseMode: true,
    trainingWheels: false,
    hideFretboardVisuals: false
  },
  progressions: {
    inverseMode: false,
    trainingWheels: false,
    hideFretboardVisuals: false
  }
};

export function useSessionLogic() {
  // --- 1. HOOKS ---
  const mixer = useMixerLogic();
  const settings = useSessionSettings();

  // --- 2. CORE SESSION STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState("Start Session");
  const [activeTab, setActiveTab] = useState("random");
  
  // NEW: Progressions mode state
  const [activeChordIndex, setActiveChordIndex] = useState<number | null>(null);
  const [activeRootMidi, setActiveRootMidi] = useState<number | null>(null); // Track root pitch for visualizer
  const currentProgression = useRef<ChordProgression | null>(null);
  
  // Track if audio has ever been initialized (for first-play fix)
  const hasInitializedAudio = useRef(false);
  
  // Store per-tab user settings (so switching back restores their choices)
  const tabSettingsCache = useRef<Record<string, typeof TAB_DEFAULTS.random>>({
    random: { ...TAB_DEFAULTS.random },
    training: { ...TAB_DEFAULTS.training },
    fretboard: { ...TAB_DEFAULTS.fretboard }
  });
  
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
  const scaleTypeRef = useRef(scaleType);

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
  useEffect(() => { scaleTypeRef.current = scaleType; }, [scaleType]);

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

  // Helper for MediaSession resume (needs stable reference)
  const resumeFromMediaSession = useCallback(() => {
    if (isPaused) {
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      audioEngine.resumePlayback();
      updateMediaSessionState(true);
    }
  }, [isPaused]);

  // Background Audio Bridge - Initialize once on mount
  useEffect(() => {
    initKeepAlive({
      onPlay: () => resumeFromMediaSession(), 
      onPause: () => pauseSession(),
      onNext: () => { if (isPlayingRef.current) runCycle(currentKeyRef.current, false); }
    }); 
  }, [resumeFromMediaSession]);

  // --- 4. TAB SWITCHING WITH AUTO-STOP AND FADE ---
  const stopWithFade = async (): Promise<void> => {
    return new Promise((resolve) => {
      // Quick fade out (200ms)
      audioEngine.setMasterVol(0);
      
      setTimeout(() => {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        audioEngine.stopAndKillBridge();
        updateMediaSessionState(false);
        training.pauseTrainingTimer();
        
        // Restore master volume for next play
        audioEngine.setMasterVol(mixer.volMaster);
        resolve();
      }, 200);
    });
  };

  const handleTabChange = async (newTab: string) => {
    if (newTab === activeTab) return;
    
    // Save current tab's settings before switching
    tabSettingsCache.current[activeTab] = {
      inverseMode: settings.inverseMode,
      trainingWheels: settings.trainingWheels,
      hideFretboardVisuals: settings.hideFretboardVisuals
    };
    
    // If playing, stop with fade-out
    if (isPlaying || isPaused) {
      await stopWithFade();
    }
    
    // Switch tab
    setActiveTab(newTab);
    
    // Restore cached settings for the new tab (or use defaults if never visited)
    const cachedSettings = tabSettingsCache.current[newTab] || TAB_DEFAULTS[newTab];
    
    // Apply tab-specific settings
if (newTab === 'fretboard') {
  // Fretboard uses pentatonic scales
  const pentatonicType = scaleType === 'Minor' || scaleType === 'PentatonicMinor' 
    ? 'PentatonicMinor' 
    : 'PentatonicMajor';
  handleScaleChange(pentatonicType);
  // Don't force inverseMode - let user toggle it via hideFretboardVisuals
} else {
      // Apply cached/default settings for random/training
      settings.setInverseMode(cachedSettings.inverseMode);
      settings.setTrainingWheels(cachedSettings.trainingWheels);
      settings.setHideFretboardVisuals(cachedSettings.hideFretboardVisuals);
    }
    
    // Reset training state when entering training tab
    if (newTab === 'training') {
      training.resetTraining();
      lastPlayedStageIndex.current = -1;
      hasPlayedScalePreview.current = false;
      hasPlayedIntroSequence.current = false;
    }
    
    setStatus("Start Session");
    setActiveMidi(null);
  };

  // --- 5. SCALE & DEGREE HANDLERS ---
  const handleScaleChange = (type: ScaleType) => {
    setScaleType(type);
    const defaults = getAvailableDegrees(type);
    setEnabledDegrees(defaults);
    enabledDegreesRef.current = defaults; 
    setFocusedDegrees([]);
    focusedDegreesRef.current = [];
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
      if (hasInitializedAudio.current) {
        await audioEngine.loadBackingTracks(k, "");
      }
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

  // --- 6. SESSION CONTROLS ---
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
    // Handle resume from pause
    if (isPaused) {
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      setStatus("Resuming...");
      updateMediaSessionState(true);
      audioEngine.resumePlayback();
      return;
    }

    // Handle pause if already playing
    if (isPlaying) {
      pauseSession();
      return;
    }

    try {
      setStatus("Initializing...");
      setIsPlaying(true);
      isPlayingRef.current = true;

      // CRITICAL: Start Tone.js AudioContext from user gesture FIRST
      await Tone.start();
      
      // Now start the keep-alive bridge (also needs user gesture context)
      await startKeepAlive();
      
      // Initialize audio engine if not already done
      if (!hasInitializedAudio.current) {
        await audioEngine.init({ 
          groove: mixer.volGroove, 
          voice: mixer.volVoice, 
          click: mixer.volMetronome, 
          master: mixer.volMaster, 
          drone: mixer.volDrone 
        });
        hasInitializedAudio.current = true;
      }

      // Reset transport
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      
      if (!isPlayingRef.current) return; 
      
      // Load backing tracks and configure
      setVisualizerKey(currentKey); 
      await audioEngine.loadBackingTracks(currentKey, ""); 
      audioEngine.setBpm(settings.bpm);
      audioEngine.setDrumPattern(settings.currentPattern);
      audioEngine.setReverbAmt(mixer.volReverb); 

      audioEngine.setFretboardMode(activeTab === 'fretboard');

      if (activeTab === 'training') training.startTrainingTimer();
      
      updateMediaSessionState(true);
      runCycle(currentKey, true);

    } catch (e) { 
      console.error("startSession error:", e); 
      setStatus("Error - Tap to retry"); 
      stopSession(); 
    }
  };

  // --- 7. GAME LOOP ---
  const runCycle = async (keyToUse: MusicalKey, isFirst = false, startTime?: number) => {
    if (!isPlayingRef.current) return;
    
    setVisualizerKey(keyToUse);
    setActiveMidi(null);
    questionCount.current += 1;
    
    let currentCycleKey = keyToUse;
    let forceOneThreeFive = false;
    let skipPrepareMessage = false;

    // A. Handle Key Changes & Modulation
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
    // Random Mode Auto-Modulation
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

    // B. Calculate fretboard range if needed
    // ENHANCED: For fretboard mode, use the FULL fretboard range
    // The AudioEngine now has hybrid vocal/synth playback, so notes outside
    // the vocal sample range will automatically use synth (sounds great!)
    let fretboardRange: { min: number; max: number } | undefined;
    if (activeTabRef.current === 'fretboard') {
      const fretConfig = getFretboardConfig(currentCycleKey, scaleTypeRef.current, settings.refs.selectedShape.current);
      const midis = fretConfig.notes.map(n => n.midi);
      const fretMin = Math.min(...midis);
      const fretMax = Math.max(...midis);
      
      // Use the FULL fretboard range - no restrictions!
      // Notes within G2-G4 will use vocal samples
      // Notes outside this range will use synth (handled by AudioEngine)
      fretboardRange = { min: fretMin, max: fretMax };
    }

    // C. Determine Constraints & Generate Melody
    let constraints: MelodyConstraints;
    let noteEvents; 
    let playSilent = settings.refs.silentPractice.current;
    let useTrainingWheels = settings.refs.trainingWheels.current;

    if (activeTabRef.current === 'training') {
      const config = training.getCurrentConfig();
      constraints = config.constraints;
      const stageIndex = config.stageIndex;

      if (stageIndex === 2) { // Stage 3 has alternating constraints
        training.incrementStage3Counter();
      }

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

      // NEW: Force training wheels in Stages 1-2, respect user choice in Stages 3-4
      if (config.forceTrainingWheels === true) {
        useTrainingWheels = true;
      } else if (config.forceTrainingWheels === false) {
        useTrainingWheels = false;
      }
      // If undefined, use user's setting

      setEnabledDegrees(constraints.allowedDegrees);

      // Track stage changes for intro sequences
      if (stageIndex !== lastPlayedStageIndex.current) {
        lastPlayedStageIndex.current = stageIndex;
        hasPlayedScalePreview.current = false;
        hasPlayedIntroSequence.current = false;
      }

      // Generate appropriate melody
      if (config.scalePreview && !hasPlayedScalePreview.current) {
        noteEvents = generateFixedPattern(
          config.scalePreview, 
          currentCycleKey, 
          scaleTypeRef.current,
          settings.refs.minVocalMidi.current,
          settings.refs.maxVocalMidi.current
        ); 
        hasPlayedScalePreview.current = true; 
      } 
      else if (config.introSequence && !hasPlayedIntroSequence.current) {
        noteEvents = generateFixedPattern(
          config.introSequence, 
          currentCycleKey, 
          scaleTypeRef.current,
          settings.refs.minVocalMidi.current,
          settings.refs.maxVocalMidi.current
        );
        hasPlayedIntroSequence.current = true; 
      }
      else {
        noteEvents = generateMelody({ 
          key: currentCycleKey, 
          scaleType: scaleTypeRef.current, 
          constraints: {
            ...constraints,
            minMidi: fretboardRange?.min ?? settings.refs.minVocalMidi.current,
            maxMidi: fretboardRange?.max ?? settings.refs.maxVocalMidi.current
          } 
        });
        playSilent = settings.refs.silentPractice.current; 
      }
    } 
    else if (activeTabRef.current === 'fretboard') {
      // Fretboard Mode
      if (forceOneThreeFive) {
        const pattern: ScaleDegree[] = scaleTypeRef.current === 'PentatonicMinor' 
          ? ["1", "b3", "5", "1"] 
          : ["1", "3", "5", "1"];
        noteEvents = generateFixedPattern(
          pattern, 
          currentCycleKey, 
          scaleTypeRef.current,
          fretboardRange?.min ?? settings.refs.minVocalMidi.current,
          fretboardRange?.max ?? settings.refs.maxVocalMidi.current
        );
        setStatus("New Key: Settling In");
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
        noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleTypeRef.current, constraints });
      }
      playSilent = settings.refs.silentPractice.current;
    }
    else if (activeTabRef.current === 'progressions') {
      // ===== PROGRESSIONS MODE =====
      
      // Clear visualizer at the start
      if (isFirst) {
        setActiveChordIndex(null);
        setActiveRootMidi(null);
      }
      
      let progression: ChordProgression;
      
      if (forceOneThreeFive) {
        // Modulation: play I-III-V-I
        progression = generateModulationProgression(currentCycleKey, scaleTypeRef.current);
        setStatus("New Key: I-III-V-I");
      } else {
        // Normal progression
        progression = generateChordProgression({
          key: currentCycleKey,
          scaleType: scaleTypeRef.current,
          difficulty: settings.refs.difficulty.current,
          startOnOne: settings.refs.startRoot.current,
          endOnOne: settings.refs.endRoot.current,
          includeDiminished: settings.refs.includeDiminished.current,
          minMidi: settings.refs.minVocalMidi.current,
          maxMidi: settings.refs.maxVocalMidi.current
        });
      }
      
      currentProgression.current = progression;
      
      // Collect all MIDI notes needed for preloading
      const allMidiNotes: number[] = [];
      progression.chords.forEach(chord => {
        const { bass, triad } = getChordMidiNotes(
          chord,
          currentCycleKey,
          settings.refs.minVocalMidi.current,
          settings.refs.maxVocalMidi.current
        );
        allMidiNotes.push(bass, ...triad);
      });
      
      // Preload chord samples (bass + piano)
      if (!isPlayingRef.current) return;
      await audioEngine.preloadChordSamples(allMidiNotes);
      if (!isPlayingRef.current) return;
      
      // ALSO preload vocal samples for pass 3 (Sing Along)
      // Create NoteEvents for each chord's root to preload vocal samples
      const vocalNoteEvents = progression.chords.map(chord => {
        const { triad } = getChordMidiNotes(
          chord,
          currentCycleKey,
          settings.refs.minVocalMidi.current,
          settings.refs.maxVocalMidi.current
        );
        const pianoRoot = triad[0];
        return {
          noteInfo: {
            degree: chord.degree,
            midi: pianoRoot,
            frequency: 440 * Math.pow(2, (pianoRoot - 69) / 12),
            label: `${chord.degree} (${pianoRoot})`
          },
          startTime: 0,
          duration: 2
        };
      });
      await audioEngine.preloadNotes(vocalNoteEvents);
      if (!isPlayingRef.current) return;
      
      // Schedule 4-pass chord progression
      const beatSec = 60 / settings.refs.bpm.current;
      const measureSec = 4 * beatSec; // NEW: For quantization
      const chordDuration = 2; // beats per chord
      const progressionDuration = progression.chords.length * chordDuration * beatSec;
      
      const schedulePass = (
        passStartTime: number, 
        playVocals: boolean, 
        statusLabel: string
      ) => {
        // Set status
        Tone.Transport.schedule((time) => {
          Tone.Draw.schedule(() => {
            if (!document.hidden) setStatus(statusLabel);
          }, time);
        }, passStartTime);
        
        // Schedule each chord
        let currentBeat = 0;
        progression.chords.forEach((chord, index) => {
          const chordTime = passStartTime + (currentBeat * beatSec);
          
          const { bass, triad } = getChordMidiNotes(
            chord,
            currentCycleKey,
            settings.refs.minVocalMidi.current,
            settings.refs.maxVocalMidi.current
          );
          
          Tone.Transport.schedule((time) => {
            // Play chord (bass + triad)
            audioEngine.playChord(bass, triad, time);
            
            // If vocal pass, play vocal sample singing the CHORD DEGREE at piano root pitch
            if (playVocals) {
              const pianoRoot = triad[0]; // Root note of piano triad
              
              // Apply timing offset for this degree (same as Random/Training modes)
              const latencyOffset = LATENCY_OFFSET[chord.degree] || 0;
              const adjustedTime = time + latencyOffset;
              
              const rootNoteEvent = {
                noteInfo: {
                  degree: chord.degree, // Use the CHORD's degree (1, 2, 3, 4, 5, 6, 7)
                  midi: pianoRoot,      // At the piano root pitch
                  frequency: 440 * Math.pow(2, (pianoRoot - 69) / 12),
                  label: `${chord.degree} (${pianoRoot})`
                },
                startTime: currentBeat,
                duration: chordDuration
              };
              // Play vocal sample with timing adjustment
              (audioEngine as any).playMelodyNote(rootNoteEvent, adjustedTime, false);
            }
            
            // Update visualizer with chord index AND root MIDI pitch
            Tone.Draw.schedule(() => {
              if (!document.hidden) {
                setActiveChordIndex(index);
                setActiveRootMidi(triad[0]); // Piano root = visualizer position
              }
            }, time);
          }, chordTime);
          
          currentBeat += chordDuration;
        });
        
        // Clear visualizer after last chord
        const endTime = passStartTime + (currentBeat * beatSec);
        Tone.Transport.schedule((time) => {
          Tone.Draw.schedule(() => {
            if (!document.hidden) {
              setActiveChordIndex(null);
              setActiveRootMidi(null);
            }
          }, time);
        }, endTime);
      };
      
      // Add settling in period for first cycle (like Random mode)
      // CRITICAL FIX: Quantize to measure boundaries like Random mode does
      let anchorTime;
      if (isFirst) {
        // First cycle: start at next measure boundary
        const now = Tone.Transport.seconds;
        if (now < 0.1) {
          anchorTime = 0;
        } else {
          anchorTime = Math.ceil(now / measureSec) * measureSec;
        }
      } else {
        // Subsequent cycles: use provided start time (already quantized)
        anchorTime = startTime || Tone.Transport.seconds;
      }
      
      const settlingDuration = isFirst ? measureSec : 0; // 1 measure settling
      const safeStartTime = anchorTime + settlingDuration;
      
      // Show "Settling In" during the intro
      if (isFirst && settlingDuration > 0) {
        Tone.Transport.schedule((time) => {
          Tone.Draw.schedule(() => {
            if (!document.hidden) {
              setStatus("Settling In...");
              setActiveChordIndex(null); // Don't highlight any chord during settling
              setActiveRootMidi(null);
            }
          }, time);
        }, anchorTime);
      }
      
      // Schedule all 4 passes
      schedulePass(safeStartTime, false, "Listen");
      schedulePass(safeStartTime + progressionDuration, false, "Listen (Again)");
      schedulePass(safeStartTime + (progressionDuration * 2), true, "Sing Along");
      schedulePass(safeStartTime + (progressionDuration * 3), false, "Affirm");
      
      // Add 2-beat break after the 4th pass before next cycle
      const breakDuration = 2 * beatSec; // 2-beat pause
      const cycleEndTime = safeStartTime + (progressionDuration * 4);
      
      // Quantize next cycle to nearest measure boundary for drum alignment
      const nextCycleStart = Math.ceil((cycleEndTime + breakDuration) / measureSec) * measureSec;
      
      // Show "Next..." during the break
      Tone.Transport.schedule((time) => {
        Tone.Draw.schedule(() => {
          if (!document.hidden) {
            setStatus("Next...");
            setActiveChordIndex(null);
            setActiveRootMidi(null);
          }
        }, time);
      }, safeStartTime + (progressionDuration * 4));
      
      Tone.Transport.schedule(() => {
        if (!isPlayingRef.current) return;
        questionCount.current++;
        runCycle(currentCycleKey, false, nextCycleStart);
      }, nextCycleStart - 0.05);
      
      // CRITICAL: Start playback if this is the first cycle
      if (isFirst) {
        audioEngine.startPlayback();
      }
      
      return; // Exit early - progressions don't use the normal melody scheduling
    }
    else {
  // Random Mode
  if (forceOneThreeFive) {
    const pattern: ScaleDegree[] = scaleTypeRef.current === 'Minor' || scaleTypeRef.current === 'PentatonicMinor'
      ? ["1", "b3", "5", "1"] 
      : ["1", "3", "5", "1"];
    noteEvents = generateFixedPattern(
      pattern, 
      currentCycleKey, 
      scaleTypeRef.current,
      settings.refs.minVocalMidi.current,
      settings.refs.maxVocalMidi.current
    );
    setStatus("New Key: Settling In");
  } else {
    constraints = {
      allowedDegrees: enabledDegreesRef.current,
      focusedDegrees: focusedDegreesRef.current, 
      startDegree: settings.refs.startRoot.current ? "1" : undefined,
      endDegree: settings.refs.endRoot.current ? "1" : undefined,     
      length: 4,
      difficulty: settings.refs.difficulty.current,
      // NEW: Add vocal range (but NOT when fretboard range exists)
      minMidi: fretboardRange ? undefined : settings.refs.minVocalMidi.current,
      maxMidi: fretboardRange ? undefined : settings.refs.maxVocalMidi.current
    };
    noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleTypeRef.current, constraints });
  }
  playSilent = settings.refs.silentPractice.current;
}

    // D. Schedule & Play
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
  startTime,
  skipPrepareMessage,
  settings.refs.inverseMode.current,
  activeTabRef.current === 'fretboard'  // FIX #3: Pass fretboard mode flag as 9th parameter
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
    setEnabledDegrees,
    focusedDegrees, toggleFocus,
    setFocusedDegrees, 
    triggerPulse,
    debugClick, setDebugClick,
    activeChordIndex, activeRootMidi, currentProgression, // NEW: For progressions mode
    
    // Spread the hooks to maintain API compatibility
    ...mixer,
    ...settings,
    
    startSession, stopSession, setKeyManually,
    training, handleLevelChange,
    scaleType, handleScaleChange
  };
}