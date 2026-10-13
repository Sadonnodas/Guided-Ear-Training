import { useRef, useCallback } from "react";
import { audioEngine } from "../audio/AudioEngine.ts";
import { withDeadline } from "../lib/withDeadline.ts";
import { speakDegree } from "../audio/speech.ts";
import { generateMelody, generateFixedPattern } from "../core/MelodyGenerator.ts";
import { getFretboardConfig } from "../config/FretboardData.ts";
import { runProgressionsCycle } from "./useProgressionsCycle.ts";
import type { ChordProgression, ChordInfo } from "../core/ChordProgressionGenerator.ts";
import { getChordMidiNotes } from "../core/ChordProgressionGenerator.ts";
import type { MusicalKey, ScaleDegree, ScaleType, MelodyConstraints, MelodyDifficulty, CagedShape } from "../types.ts";
import { KEYS, KEY_DISPLAY_MAP } from "./sessionConstants.ts";

const ANCHOR_CHORD_BEATS = 2;
// Two bars of silence to find and sing the tonic in: long enough to hunt for
// it, short enough that you commit rather than work it out.
const TONIC_SILENCE_BEATS = 8;
// Room for the phone to finish saying "sing flat seven" before the silence
// that is yours.
const PROMPT_BEATS = 3;

/**
 * The anchor progression: I-IV-V-I, the plainest way to state a key.
 * Minor uses i-iv-V-i — the major V is what makes a minor key sound settled.
 */
function anchorChords(scaleType: ScaleType): ChordInfo[] {
  const minor = scaleType === 'Minor' || scaleType === 'PentatonicMinor';
  const major = (roman: string, degree: ScaleDegree): ChordInfo =>
    ({ roman, degree, quality: 'major', intervals: [0, 4, 7] });
  const min = (roman: string, degree: ScaleDegree): ChordInfo =>
    ({ roman, degree, quality: 'minor', intervals: [0, 3, 7] });

  return minor
    ? [min('i', '1'), min('iv', '4'), major('V', '5'), min('i', '1')]
    : [major('I', '1'), major('IV', '4'), major('V', '5'), major('I', '1')];
}

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
      keyAnchor: React.MutableRefObject<'drone' | 'vocals' | 'chords'>;
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
  setTonicRevealed: (revealed: boolean) => void;
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
      setTonicRevealed,
    } = deps;

    if (!isPlayingRef.current) return;

    setVisualizerKey(keyToUse);
    setActiveMidi(null);
    questionCount.current += 1;

    // ── Find the Tonic ─────────────────────────────────────────────────────────
    // Its own shape: the key stated by chords, then a named degree to sing
    // from memory, then that degree sung back. Recognising a degree you are
    // given and producing one you are asked for are different skills, and
    // only the second is what singing or playing by ear actually needs.
    if (activeTabRef.current === 'tonic') {
      // The chords state the key; they are repeated only when it changes, so
      // Melodies Per Key decides how many degrees you sing per key.
      const keyChanged = isFirst || questionCount.current > settings.refs.questionsPerKey.current;
      let roundKey = keyToUse;
      if (keyChanged) {
        questionCount.current = 1;
        const options = KEYS.filter((k: MusicalKey) => k !== keyToUse);
        roundKey = options[Math.floor(Math.random() * options.length)];
      }

      // Whatever is lit in the visualizer, so you can start on 1-3-5 and open
      // it up later.
      const pool = enabledDegreesRef.current.length ? enabledDegreesRef.current : (["1"] as ScaleDegree[]);
      const degree = pool[Math.floor(Math.random() * pool.length)];

      const voiced = keyChanged
        ? anchorChords(scaleTypeRef.current).map((chord) => getChordMidiNotes(
            chord, roundKey,
            settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current,
          ))
        : [];
      const [revealNote] = generateFixedPattern(
        [degree], roundKey, scaleTypeRef.current,
        settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current,
      );

      await withDeadline(Promise.all([
        voiced.length
          ? audioEngine.preloadChordSamples(voiced.flatMap(v => [v.bass, ...v.triad]))
          : Promise.resolve(),
        audioEngine.preloadNotes([revealNote]),
        audioEngine.loadPromptBuffer(degree),
      ]), 5000, 'degree preload').catch((e) => console.warn('Degree preload stalled.', e));
      if (!isPlayingRef.current) return;

      if (keyChanged) setTonicRevealed(false);
      audioEngine.scheduleDegreeRound({
        playChords: voiced.length
          ? (time, beatSec) => {
              voiced.forEach((v, i) => {
                audioEngine.playChord(v.bass, v.triad, time + i * ANCHOR_CHORD_BEATS * beatSec);
              });
            }
          : null,
        chordBeats: voiced.length * ANCHOR_CHORD_BEATS,
        promptBeats: PROMPT_BEATS,
        silenceBeats: TONIC_SILENCE_BEATS,
        promptLabel: `Sing ${degree}`,
        revealLabel: `That was ${degree}`,
        // The recording if we have it, the device's own voice if we do not.
        onPrompt: (time) => { if (!audioEngine.playPrompt(degree, time)) speakDegree(degree); },
        revealNote,
        onReveal: () => {
          // The key is only named once you have answered.
          setCurrentKey(roundKey);
          setVisualizerKey(roundKey);
          setTonicRevealed(true);
        },
        onComplete: (next) => { if (isPlayingRef.current) runCycle(roundKey, false, next); },
        atTime: startTime,
      });

      if (isFirst) audioEngine.startPlayback();
      return;
    }

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
      await audioEngine.loadBackingTracksWithin(currentCycleKey);
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
      await audioEngine.loadBackingTracksWithin(newKey);
      if (!isPlayingRef.current) return;
      currentCycleKey = newKey;
      setVisualizerKey(newKey);
      forceOneThreeFive = true;
    }

    // ── A2. Key anchor ─────────────────────────────────────────────────────────
    // With an anchor chosen, a key change states the key ONCE — sung 1-3-5-1,
    // or a I-IV-V-I — instead of running the settling pattern through the full
    // listen/repeat structure. From then until the next change there is no
    // reference at all, which is the exercise.
    const anchor = settings.refs.keyAnchor.current;
    // isFirst as well as forceOneThreeFive: the first cycle of a session is
    // not a key change, so without it the session opened cold — straight into
    // a melody with the key never stated, which is the one round where you
    // have nothing at all to go on.
    if ((forceOneThreeFive || isFirst) && anchor !== 'drone' && activeTabRef.current === 'random') {
      const anchorKey = currentCycleKey;

      // Stating the key is not one of the melodies for that key. Without
      // this the anchor eats the key's only slot when Melodies Per Key is 1,
      // and the session modulates forever without ever asking you anything.
      questionCount.current = 0;

      if (anchor === 'vocals') {
        const pattern: ScaleDegree[] = (scaleTypeRef.current === 'Minor' || scaleTypeRef.current === 'PentatonicMinor')
          ? ["1", "b3", "5", "1"] : ["1", "3", "5", "1"];
        const anchorNotes = generateFixedPattern(
          pattern, anchorKey, scaleTypeRef.current,
          settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current,
        );
        await withDeadline(audioEngine.preloadNotes(anchorNotes), 5000, 'anchor preload')
          .catch((e) => console.warn('Anchor preload stalled.', e));
        if (!isPlayingRef.current) return;

        setStatus(`Key: ${KEY_DISPLAY_MAP[anchorKey]}`);
        audioEngine.scheduleAnchor({
          notes: anchorNotes,
          playChords: null,
          beatsLong: 4,
          label: `Key: ${KEY_DISPLAY_MAP[anchorKey]}`,
          onComplete: (next) => { if (isPlayingRef.current) runCycle(anchorKey, false, next); },
          atTime: startTime,
        });
      } else {
        const chords = anchorChords(scaleTypeRef.current);
        const voiced = chords.map((chord) => getChordMidiNotes(
          chord, anchorKey,
          settings.refs.minVocalMidi.current, settings.refs.maxVocalMidi.current,
        ));
        await withDeadline(
          audioEngine.preloadChordSamples(voiced.flatMap(v => [v.bass, ...v.triad])),
          5000, 'anchor chord preload',
        ).catch((e) => console.warn('Anchor preload stalled.', e));
        if (!isPlayingRef.current) return;

        setStatus(`Key: ${KEY_DISPLAY_MAP[anchorKey]}`);
        audioEngine.scheduleAnchor({
          notes: null,
          playChords: (time, beatSec) => {
            voiced.forEach((v, i) => {
              audioEngine.playChord(v.bass, v.triad, time + i * ANCHOR_CHORD_BEATS * beatSec);
            });
          },
          beatsLong: voiced.length * ANCHOR_CHORD_BEATS,
          label: `Key: ${KEY_DISPLAY_MAP[anchorKey]}`,
          onComplete: (next) => { if (isPlayingRef.current) runCycle(anchorKey, false, next); },
          atTime: startTime,
        });
      }

      if (isFirst) audioEngine.startPlayback();
      return;
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
        await audioEngine.loadBackingTracksWithin(newKey);
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
      // Deadlined and allowed to fail: decoding runs on the audio context, so
      // a dead one hangs here for good — this is where the app sat on
      // "Initializing..." after a call. Notes with no sample fall back to the
      // synth, which is a far better outcome than never playing again.
      await withDeadline(audioEngine.preloadNotes(noteEvents), 5000, 'preloadNotes')
        .catch((e) => console.warn('Sample preload stalled; using the synth.', e));
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