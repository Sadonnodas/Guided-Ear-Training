/**
 * useSessionLogic — top-level orchestrator
 *
 * This file is intentionally thin. It owns:
 *   - all React state and refs
 *   - session lifecycle (start / pause / stop / tab-switch)
 *   - scale & degree handlers
 *   - the public API returned to the UI
 *
 * Heavy sub-concerns live in their own files:
 *   useGameLoop          — runCycle() for training / fretboard / random modes
 *   useProgressionsCycle — async progression scheduling (called by useGameLoop)
 *   sessionConstants     — KEYS, KEY_DISPLAY_MAP, TAB_DEFAULTS
 */

import * as Tone from "tone";
import { useState, useRef, useEffect, useCallback } from "react";
import { audioEngine } from "../audio/AudioEngine.ts";
import { initKeepAlive, updateMediaSessionState, startKeepAlive } from "../audio/KeepAlive.ts";
import { useAudioSetup } from "./useAudioSetup.ts";
import { useTrainingMode } from "./useTrainingMode.ts";
import { useMixerLogic } from "./useMixerLogic.ts";
import { useSessionSettings } from "./useSessionSettings.ts";
import { getAvailableDegrees } from "../audio/MusicTheory.ts";
import { useGameLoop } from "./useGameLoop.ts";
import { KEY_DISPLAY_MAP, TAB_DEFAULTS } from "./sessionConstants.ts";
import type { ChordProgression } from "../core/ChordProgressionGenerator.ts";
import type { MusicalKey, ScaleDegree, ScaleType } from "../types.ts";

export function useSessionLogic() {
  // ── Sub-hooks ────────────────────────────────────────────────────────────────
  const mixer    = useMixerLogic();
  const settings = useSessionSettings();

  // ── Core session state ───────────────────────────────────────────────────────
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);
  const [status,      setStatus]      = useState("Start Session");
  const [activeTab,   setActiveTab]   = useState("random");

  // Progressions visualizer state
  const [activeChordIndex, setActiveChordIndex] = useState<number | null>(null);
  const [activeRootMidi,   setActiveRootMidi]   = useState<number | null>(null);
  const currentProgression = useRef<ChordProgression | null>(null);

  // Audio init guard
  const hasInitializedAudio = useRef(false);

  // Per-tab settings cache (restores user choices on tab switch)
  const tabSettingsCache = useRef<Record<string, typeof TAB_DEFAULTS.random>>({
    random:    { ...TAB_DEFAULTS.random },
    training:  { ...TAB_DEFAULTS.training },
    fretboard: { ...TAB_DEFAULTS.fretboard },
  });

  // ── Music theory state ───────────────────────────────────────────────────────
  const [currentKey,     setCurrentKey]     = useState<MusicalKey>("C");
  const [visualizerKey,  setVisualizerKey]  = useState<MusicalKey>("C");
  const [scaleType,      setScaleType]      = useState<ScaleType>("Major");
  const [enabledDegrees, setEnabledDegrees] = useState<ScaleDegree[]>(["1","2","3","4","5","6","7"]);
  const [focusedDegrees, setFocusedDegrees] = useState<ScaleDegree[]>([]);
  const [activeMidi,     setActiveMidi]     = useState<number | null>(null);

  // ── Visual / debug state ─────────────────────────────────────────────────────
  const [triggerPulse, setTriggerPulse] = useState(false);
  const [debugClick,   setDebugClick]   = useState(false);
  const visualTimeoutRef = useRef<number>(0);

  // ── Logic refs (read by async callbacks without stale closures) ──────────────
  const isPlayingRef      = useRef(false);
  const questionCount     = useRef(0);
  const activeTabRef      = useRef(activeTab);
  const enabledDegreesRef = useRef(enabledDegrees);
  const focusedDegreesRef = useRef(focusedDegrees);
  const currentKeyRef     = useRef(currentKey);
  const scaleTypeRef      = useRef(scaleType);

  // ── Training refs ────────────────────────────────────────────────────────────
  const training               = useTrainingMode(scaleType);
  const lastPlayedStageIndex   = useRef<number>(-1);
  const hasPlayedScalePreview  = useRef(false);
  const hasPlayedIntroSequence = useRef(false);

  // ── Keep refs in sync with state ─────────────────────────────────────────────
  useEffect(() => { activeTabRef.current      = activeTab;      }, [activeTab]);
  useEffect(() => { enabledDegreesRef.current = enabledDegrees; }, [enabledDegrees]);
  useEffect(() => { focusedDegreesRef.current = focusedDegrees; }, [focusedDegrees]);
  useEffect(() => { currentKeyRef.current     = currentKey;     }, [currentKey]);
  useEffect(() => { scaleTypeRef.current      = scaleType;      }, [scaleType]);

  useEffect(() => {
    audioEngine.onStatusChange = (text) => setStatus(text);
    return () => { audioEngine.onStatusChange = null; };
  }, []);

  // Audio volume sync
  useAudioSetup({
    bpm: settings.bpm,
    volMaster: mixer.volMaster,     volGroove: mixer.volGroove,
    volVoice:  mixer.volVoice,      volMetronome: mixer.volMetronome,
    volDrone:  mixer.volDrone,
    debugClick, setTriggerPulse, setActiveMidi, visualTimeoutRef,
  });

  // ── Game loop ────────────────────────────────────────────────────────────────
  const { runCycle } = useGameLoop({
    isPlayingRef, questionCount, activeTabRef,
    currentKeyRef, scaleTypeRef, enabledDegreesRef, focusedDegreesRef,
    lastPlayedStageIndex, hasPlayedScalePreview, hasPlayedIntroSequence,
    currentProgression,
    settings,
    training,
    setVisualizerKey, setActiveMidi, setStatus, setCurrentKey,
    setEnabledDegrees, setActiveChordIndex, setActiveRootMidi,
  });

  // ── MediaSession / KeepAlive ─────────────────────────────────────────────────
  const resumeFromMediaSession = useCallback(() => {
    if (isPaused) {
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      audioEngine.resumePlayback();
      updateMediaSessionState(true);
    }
  }, [isPaused]);

  useEffect(() => {
    initKeepAlive({
      onPlay:  () => resumeFromMediaSession(),
      onPause: () => pauseSession(),
      onNext:  () => { if (isPlayingRef.current) runCycle(currentKeyRef.current, false); },
    });
  }, [resumeFromMediaSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab switching ────────────────────────────────────────────────────────────
  const stopWithFade = (): Promise<void> =>
    new Promise((resolve) => {
      audioEngine.setMasterVol(0);
      setTimeout(() => {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        audioEngine.stopAndKillBridge();
        updateMediaSessionState(false);
        training.pauseTrainingTimer();
        audioEngine.setMasterVol(mixer.volMaster);
        resolve();
      }, 200);
    });

  const handleTabChange = async (newTab: string) => {
    if (newTab === activeTab) return;

    tabSettingsCache.current[activeTab] = {
      inverseMode:          settings.inverseMode,
      trainingWheels:       settings.trainingWheels,
      hideFretboardVisuals: settings.hideFretboardVisuals,
    };

    if (isPlaying || isPaused) await stopWithFade();

    setActiveTab(newTab);

    const cached = tabSettingsCache.current[newTab] || TAB_DEFAULTS[newTab];

    if (newTab === 'fretboard') {
      const pentatonicType = (scaleType === 'Minor' || scaleType === 'PentatonicMinor')
        ? 'PentatonicMinor' : 'PentatonicMajor';
      handleScaleChange(pentatonicType);
    } else {
      settings.setInverseMode(cached.inverseMode);
      settings.setTrainingWheels(cached.trainingWheels);
      settings.setHideFretboardVisuals(cached.hideFretboardVisuals);
    }

    if (newTab === 'training') {
      training.resetTraining();
      lastPlayedStageIndex.current   = -1;
      hasPlayedScalePreview.current  = false;
      hasPlayedIntroSequence.current = false;
    }

    setStatus("Start Session");
    setActiveMidi(null);
  };

  // ── Scale & degree handlers ──────────────────────────────────────────────────
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
    if (activeTab !== 'random' && activeTab !== 'progressions') return;
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
    if (activeTab !== 'random' && activeTab !== 'progressions') return;
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
      if (hasInitializedAudio.current) await audioEngine.loadBackingTracks(k, "");
    }
  };

  const handleLevelChange = (newLevelId: number) => {
    training.setActiveLevelId(newLevelId);
    lastPlayedStageIndex.current   = -1;
    hasPlayedScalePreview.current  = false;
    hasPlayedIntroSequence.current = false;
    if (isPlaying) {
      audioEngine.softReset();
      training.resetTraining();
      training.startTrainingTimer();
      runCycle(currentKey, true);
    }
  };

  // ── Session controls ─────────────────────────────────────────────────────────
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
      updateMediaSessionState(true);
      audioEngine.resumePlayback();
      return;
    }
    if (isPlaying) { pauseSession(); return; }

    try {
      setStatus("Initializing...");
      setIsPlaying(true);
      isPlayingRef.current = true;

      await Tone.start();
      await startKeepAlive();

      if (!hasInitializedAudio.current) {
        await audioEngine.init({
          groove: mixer.volGroove, voice: mixer.volVoice,
          click:  mixer.volMetronome, master: mixer.volMaster, drone: mixer.volDrone,
        });
        hasInitializedAudio.current = true;
      }

      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      if (!isPlayingRef.current) return;

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

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    activeTab,   setActiveTab: handleTabChange,
    isPlaying,   isPaused,
    currentKey,  visualizerKey,
    status,
    activeMidi,
    enabledDegrees, toggleDegree,  setEnabledDegrees,
    focusedDegrees, toggleFocus,   setFocusedDegrees,
    triggerPulse,
    debugClick, setDebugClick,
    activeChordIndex, activeRootMidi, currentProgression,

    ...mixer,
    ...settings,

    startSession, stopSession, setKeyManually,
    training, handleLevelChange,
    scaleType, handleScaleChange,
  };
}