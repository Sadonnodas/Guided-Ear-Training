import { useRef, useCallback } from "react";
import { audioEngine } from "../audio/AudioEngine.ts";
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator.ts";
import { getFretboardConfig } from "../config/FretboardData.ts";
import { runProgressionsCycle } from "./useProgressionsCycle.ts";
import type { ChordProgression } from "../core/ChordProgressionGenerator.ts";
import type { MusicalKey, ScaleDegree, ScaleType, MelodyConstraints, MelodyDifficulty, CagedShape } from "../types.ts";
import { KEYS, KEY_DISPLAY_MAP } from "./sessionConstants.ts";

// Everything runCycle needs, threaded in as a single deps object so the
// hook signature stays stable even as the game loop grows.
export interface GameLoopDeps {
  // Playback state refs
  isPlayingRef: React.MutableRefObject<boolean>;
  questionCount: React.MutableRefObject<number>;
  activeTabRef: React.MutableRefObject<string>;
  currentKeyRef: React.MutableRefObject<MusicalKey>;
  scaleTypeRef: React.MutableRefObject<ScaleType>;
  enabledDegreesRef: React.MutableRefObject<ScaleDegree[]>;
  focusedDegreesRef: React.MutableRefObject<ScaleDegree[]>;

  // Training state refs
  lastPlayedStageIndex: React.MutableRefObject<number>;
  hasPlayedScalePreview: React.MutableRefObject<boolean>;
  hasPlayedIntroSequence: React.MutableRefObject<boolean>;

  // Progressions state ref
  currentProgression: React.MutableRefObject<ChordProgression | null>;

  // Settings (with ref sub-object)
  settings: {
    bpm: number;
    refs: {
      bpm: React.MutableRefObject<number>;
      questionsPerKey: React.MutableRefObject<number>;
      difficulty: React.MutableRefObject<MelodyDifficulty>;
      startRoot: React.MutableRefObject<boolean>;
      endRoot: React.MutableRefObject<boolean>;
      includeSevenths: React.MutableRefObject<boolean>;
      enabledInversions: React.MutableRefObject<number[]>;
      minVocalMidi: React.MutableRefObject<number>;
      maxVocalMidi: React.MutableRefObject<number>;
      silentPractice: React.MutableRefObject<boolean>;
      trainingWheels: React.MutableRefObject<boolean>;
      inverseMode: React.MutableRefObject<boolean>;
      selectedShape: React.MutableRefObject<CagedShape>;
    };
  };

  // Training hook surface
  training: {
    getCurrentConfig: () => {
      constraints: MelodyConstraints;
      stageIndex: number;
      questionsPerKey?: number;
      forceTrainingWheels?: boolean;
      scalePreview?: ScaleDegree[];
      introSequence?: ScaleDegree[];
    };
    incrementStage3Counter: () => void;
  };

  // State setters
  setVisualizerKey: (k: MusicalKey) => void;
  setActiveMidi: (m: number | null) => void;
  setStatus: (s: string) => void;
  setCurrentKey: (k: MusicalKey) => void;
  setEnabledDegrees: (d: ScaleDegree[]) => void;
  setActiveChordIndex: (i: number | null) => void;
  setActiveRootMidi: (m: number | null) => void;
}

export function useGameLoop(deps: GameLoopDeps) {
  // Keep a stable ref to runCycle so we can pass it to the progressions helper
  // without stale-closure issues.
  const runCycleRef = useRef<(key: MusicalKey, isFirst: boolean, startTime?: number) => void>(
    () => {}
  );

  const runCycle = useCallback(async (
    keyToUse: MusicalKey,
    isFirst = false,
    startTime?: number
  ) => {
    const {
      isPlayingRef, questionCount, activeTabRef, currentKeyRef,
      scaleTypeRef, enabledDegreesRef, focusedDegreesRef,
      lastPlayedStageIndex, hasPlayedScalePreview, hasPlayedIntroSequence,
      currentProgression,
      settings, training,
      setVisualizerKey, setActiveMidi, setStatus, setCurrentKey,
      setEnabledDegrees, setActiveChordIndex, setActiveRootMidi,
    } = deps;

    if (!isPlayingRef.current) return;

    setVisualizerKey(keyToUse);
    setActiveMidi(null);
    questionCount.current += 1;

    let currentCycleKey = keyToUse;
    let forceOneThreeFive = false;
    let skipPrepareMessage = false;

    // ── A. Key change / auto-modulation ────────────────────────────────────────
    if (currentKeyRef.current !== keyToUse) {
      // User changed key mid-session
      currentCycleKey = currentKeyRef.current;
      setStatus(`Key Change: ${KEY_DISPLAY_MAP[currentCycleKey]}`);
      skipPrepareMessage = true;
      if (!isPlayingRef.current) return;
      await audioEngine.loadBackingTracks(currentCycleKey, "");
      if (!isPlayingRef.current) return;
      setVisualizerKey(currentCycleKey);
      forceOneThreeFive = true;
      questionCount.current = 1;
    } else if (
      activeTabRef.current === 'random' &&
      questionCount.current > settings.refs.questionsPerKey.current
    ) {
      // Random-mode auto-modulation
      questionCount.current = 1;
      const otherKeys = KEYS.filter((k: MusicalKey) => k !== keyToUse);
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

    // ── B. Fretboard MIDI range ─────────────────────────────────────────────────
    let fretboardRange: { min: number; max: number } | undefined;
    if (activeTabRef.current === 'fretboard') {
      const fretConfig = getFretboardConfig(
        currentCycleKey,
        scaleTypeRef.current,
        settings.refs.selectedShape.current
      );
      const midis = fretConfig.notes.map(n => n.midi);
      fretboardRange = { min: Math.min(...midis), max: Math.max(...midis) };
    }

    // ── C. Progressions branch (handled entirely by helper) ────────────────────
    if (activeTabRef.current === 'progressions') {
      await runProgressionsCycle(
        currentCycleKey, isFirst, startTime, forceOneThreeFive,
        {
          isPlayingRef, questionCount, currentProgression,
          settings: { refs: settings.refs },
          scaleTypeRef, enabledDegreesRef, focusedDegreesRef,
          setStatus, setCurrentKey, setVisualizerKey,
          setActiveChordIndex, setActiveRootMidi,
          runCycle: runCycleRef.current,
        }
      );
      return;
    }

    // ── D. Melody generation (training / fretboard / random) ───────────────────
    let noteEvents;
    let playSilent = settings.refs.silentPractice.current;
    let useTrainingWheels = settings.refs.trainingWheels.current;
    let constraints: MelodyConstraints;

    if (activeTabRef.current === 'training') {
      const config = training.getCurrentConfig();
      constraints = config.constraints;

      if (config.stageIndex === 2) training.incrementStage3Counter();

      // Training auto-modulation
      const qLimit = config.questionsPerKey ?? Infinity;
      if (questionCount.current > qLimit) {
        questionCount.current = 1;
        const otherKeys = KEYS.filter((k: MusicalKey) => k !== keyToUse);
        const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
        setCurrentKey(newKey);
        setStatus(`Level Modulation: ${KEY_DISPLAY_MAP[newKey]}`);
        await audioEngine.loadBackingTracks(newKey, "");
        currentCycleKey = newKey;
      }

      // Auto-focus on newest degree for first 4 questions
      if (questionCount.current <= 4 && constraints.allowedDegrees.length > 0) {
        const newestDegree = constraints.allowedDegrees[constraints.allowedDegrees.length - 1];
        constraints.focusedDegrees = [newestDegree];
        setStatus(`Learning: ${newestDegree}`);
      }

      // Training wheels override
      if (config.forceTrainingWheels === true)       useTrainingWheels = true;
      else if (config.forceTrainingWheels === false) useTrainingWheels = false;

      setEnabledDegrees(constraints.allowedDegrees);

      // Reset intro flags on stage change
      if (config.stageIndex !== lastPlayedStageIndex.current) {
        lastPlayedStageIndex.current = config.stageIndex;
        hasPlayedScalePreview.current = false;
        hasPlayedIntroSequence.current = false;
      }

      // Pick the right note events for this moment in the stage
      if (config.scalePreview && !hasPlayedScalePreview.current) {
        noteEvents = generateFixedPattern(
          config.scalePreview, currentCycleKey, scaleTypeRef.current,
          settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current
        );
        hasPlayedScalePreview.current = true;
      } else if (config.introSequence && !hasPlayedIntroSequence.current) {
        noteEvents = generateFixedPattern(
          config.introSequence, currentCycleKey, scaleTypeRef.current,
          settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current
        );
        hasPlayedIntroSequence.current = true;
      } else {
        noteEvents = generateMelody({
          key: currentCycleKey,
          scaleType: scaleTypeRef.current,
          constraints: {
            ...constraints,
            minMidi: fretboardRange?.min ?? settings.refs.minVocalMidi.current,
            maxMidi: fretboardRange?.max ?? settings.refs.maxVocalMidi.current,
          },
        });
        playSilent = settings.refs.silentPractice.current;
      }

    } else if (activeTabRef.current === 'fretboard') {
      if (forceOneThreeFive) {
        const pattern: ScaleDegree[] = scaleTypeRef.current === 'PentatonicMinor'
          ? ["1", "b3", "5", "1"] : ["1", "3", "5", "1"];
        noteEvents = generateFixedPattern(
          pattern, currentCycleKey, scaleTypeRef.current,
          fretboardRange?.min ?? settings.refs.minVocalMidi.current,
          fretboardRange?.max ?? settings.refs.maxVocalMidi.current
        );
        setStatus("New Key: Settling In");
      } else {
        constraints = {
          allowedDegrees: enabledDegreesRef.current,
          focusedDegrees: focusedDegreesRef.current,
          startDegree: settings.refs.startRoot.current ? "1" : undefined,
          endDegree:   settings.refs.endRoot.current   ? "1" : undefined,
          length: 4,
          difficulty: settings.refs.difficulty.current,
          minMidi: fretboardRange?.min,
          maxMidi: fretboardRange?.max,
        };
        noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleTypeRef.current, constraints });
      }
      playSilent = settings.refs.silentPractice.current;

    } else {
      // Random mode
      if (forceOneThreeFive) {
        const pattern: ScaleDegree[] = (scaleTypeRef.current === 'Minor' || scaleTypeRef.current === 'PentatonicMinor')
          ? ["1", "b3", "5", "1"] : ["1", "3", "5", "1"];
        noteEvents = generateFixedPattern(
          pattern, currentCycleKey, scaleTypeRef.current,
          settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current
        );
        setStatus("New Key: Settling In");
      } else {
        constraints = {
          allowedDegrees: enabledDegreesRef.current,
          focusedDegrees: focusedDegreesRef.current,
          startDegree: settings.refs.startRoot.current ? "1" : undefined,
          endDegree:   settings.refs.endRoot.current   ? "1" : undefined,
          length: 4,
          difficulty: settings.refs.difficulty.current,
          minMidi: fretboardRange ? undefined : settings.refs.minVocalMidi.current,
          maxMidi: fretboardRange ? undefined : settings.refs.maxVocalMidi.current,
        };
        noteEvents = generateMelody({ key: currentCycleKey, scaleType: scaleTypeRef.current, constraints });
      }
      playSilent = settings.refs.silentPractice.current;
    }

    // ── E. Preload & schedule ───────────────────────────────────────────────────
    if (noteEvents && isPlayingRef.current) {
      await audioEngine.preloadNotes(noteEvents);
      if (!isPlayingRef.current) return;

      audioEngine.scheduleRoutine(
        noteEvents,
        playSilent,
        useTrainingWheels,
        isFirst,
        (nextStartTime) => {
          if (isPlayingRef.current) runCycle(currentCycleKey, false, nextStartTime);
        },
        startTime,
        skipPrepareMessage,
        settings.refs.inverseMode.current,
        activeTabRef.current === 'fretboard'
      );

      if (isFirst) audioEngine.startPlayback();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // deps object is a stable ref — intentionally empty dep array

  // Keep the ref in sync so progressionsCycle can always call the latest version
  runCycleRef.current = runCycle;

  return { runCycle };
}