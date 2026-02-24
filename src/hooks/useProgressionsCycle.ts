import * as Tone from "tone";
import { audioEngine } from "../audio/AudioEngine.ts";
import {
  generateChordProgression,
  generateModulationProgression,
  getChordMidiNotes,
  type ChordProgression,
} from "../core/ChordProgressionGenerator.ts";
import { LATENCY_OFFSET } from "../config/AudioConfig.ts";
import type { MusicalKey, ScaleDegree, ScaleType, MelodyDifficulty } from "../types.ts";
import { KEYS, KEY_DISPLAY_MAP } from "./sessionConstants.ts";

// The shape of everything the progressions cycle needs from outside.
// All plain values or refs — no React state setters are passed as objects;
// each setter is a discrete callback so the call-sites stay readable.
export interface ProgressionsCycleDeps {
  // Refs
  isPlayingRef: React.MutableRefObject<boolean>;
  questionCount: React.MutableRefObject<number>;
  currentProgression: React.MutableRefObject<ChordProgression | null>;

  // Settings refs (read-only snapshot accessors)
  settings: {
    refs: {
      bpm: React.MutableRefObject<number>;
      questionsPerKey: React.MutableRefObject<number>;
      difficulty: React.MutableRefObject<MelodyDifficulty>;
      startRoot: React.MutableRefObject<boolean>;
      endRoot: React.MutableRefObject<boolean>;
      includeDiminished: React.MutableRefObject<boolean>;
      minVocalMidi: React.MutableRefObject<number>;
      maxVocalMidi: React.MutableRefObject<number>;
    };
  };

  // Current musical context
  scaleTypeRef: React.MutableRefObject<ScaleType>;
  enabledDegreesRef: React.MutableRefObject<ScaleDegree[]>;
  focusedDegreesRef: React.MutableRefObject<ScaleDegree[]>;

  // State setters
  setStatus: (s: string) => void;
  setCurrentKey: (k: MusicalKey) => void;
  setVisualizerKey: (k: MusicalKey) => void;
  setActiveChordIndex: (i: number | null) => void;
  setActiveRootMidi: (m: number | null) => void;

  // Callback to kick off the next cycle
  runCycle: (key: MusicalKey, isFirst: boolean, startTime?: number) => void;
}

/**
 * Runs one full progressions "round":
 *   - optional auto-modulation
 *   - progression generation
 *   - sample preloading
 *   - 4-pass Tone.Transport scheduling (Listen → Listen Again → Sing Along → Affirm)
 *   - schedules the next runCycle call
 *
 * Returns early (without scheduling) if playback was stopped during async work.
 */
export async function runProgressionsCycle(
  currentCycleKey: MusicalKey,
  isFirst: boolean,
  startTime: number | undefined,
  forceOneThreeFive: boolean,
  deps: ProgressionsCycleDeps
): Promise<void> {
  const {
    isPlayingRef, questionCount, currentProgression,
    settings, scaleTypeRef, enabledDegreesRef, focusedDegreesRef,
    setStatus, setCurrentKey, setVisualizerKey,
    setActiveChordIndex, setActiveRootMidi,
    runCycle,
  } = deps;

  // Clear visualizer on first cycle
  if (isFirst) {
    setActiveChordIndex(null);
    setActiveRootMidi(null);
  }

  // ── Auto-modulation ─────────────────────────────────────────────────────────
  let cycleKey = currentCycleKey;
  let forceSettle = forceOneThreeFive;

  if (!forceSettle && questionCount.current > settings.refs.questionsPerKey.current) {
    questionCount.current = 1;
    const otherKeys = KEYS.filter((k: MusicalKey) => k !== cycleKey);
    const newKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
    setCurrentKey(newKey);
    setStatus(`Modulating to ${KEY_DISPLAY_MAP[newKey]}...`);
    await audioEngine.loadBackingTracks(newKey, "");
    if (!isPlayingRef.current) return;
    cycleKey = newKey;
    setVisualizerKey(newKey);
    forceSettle = true;
  }

  // ── Generate progression ────────────────────────────────────────────────────
  let progression: ChordProgression;

  if (forceSettle) {
    progression = generateModulationProgression(cycleKey, scaleTypeRef.current);
    setStatus("New Key: I-III-V-I");
  } else {
    progression = generateChordProgression({
      key: cycleKey,
      scaleType: scaleTypeRef.current,
      difficulty: settings.refs.difficulty.current,
      startOnOne: settings.refs.startRoot.current,
      endOnOne: settings.refs.endRoot.current,
      includeDiminished: settings.refs.includeDiminished.current,
      minMidi: settings.refs.minVocalMidi.current,
      maxMidi: settings.refs.maxVocalMidi.current,
      enabledDegrees: enabledDegreesRef.current,
      focusedDegrees: focusedDegreesRef.current,
    });
  }

  currentProgression.current = progression;

  // ── Preload samples ─────────────────────────────────────────────────────────
  const allMidiNotes: number[] = [];
  progression.chords.forEach(chord => {
    const { bass, triad } = getChordMidiNotes(
      chord, cycleKey,
      settings.refs.minVocalMidi.current,
      settings.refs.maxVocalMidi.current
    );
    allMidiNotes.push(bass, ...triad);
  });

  if (!isPlayingRef.current) return;
  const t0 = performance.now();
  await audioEngine.preloadChordSamples(allMidiNotes);
  if (!isPlayingRef.current) return;

  // Preload vocal samples for the Sing Along pass
  const vocalNoteEvents = progression.chords.map(chord => {
    const { triad } = getChordMidiNotes(
      chord, cycleKey,
      settings.refs.minVocalMidi.current,
      settings.refs.maxVocalMidi.current
    );
    const pianoRoot = triad[0];
    return {
      noteInfo: {
        degree: chord.degree,
        midi: pianoRoot,
        frequency: 440 * Math.pow(2, (pianoRoot - 69) / 12),
        label: `${chord.degree} (${pianoRoot})`,
      },
      startTime: 0,
      duration: 2,
    };
  });
  await audioEngine.preloadNotes(vocalNoteEvents);
  console.log(`✅ Chord samples preloaded in ${(performance.now() - t0).toFixed(0)}ms`);
  if (!isPlayingRef.current) return;

  // ── Timing constants ────────────────────────────────────────────────────────
  const beatSec = 60 / settings.refs.bpm.current;
  const measureSec = 4 * beatSec;
  const chordDuration = 2; // beats per chord
  const progressionDuration = progression.chords.length * chordDuration * beatSec;

  // ── schedulePass helper ─────────────────────────────────────────────────────
  const schedulePass = (passStartTime: number, playVocals: boolean, label: string) => {
    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => { if (!document.hidden) setStatus(label); }, time);
    }, passStartTime);

    let beat = 0;
    progression.chords.forEach((chord, index) => {
      const chordTime = passStartTime + beat * beatSec;
      const { bass, triad } = getChordMidiNotes(
        chord, cycleKey,
        settings.refs.minVocalMidi.current,
        settings.refs.maxVocalMidi.current
      );

      Tone.Transport.schedule((time) => {
        audioEngine.playChord(bass, triad, time);

        if (playVocals) {
          const pianoRoot = triad[0];
          const latency = LATENCY_OFFSET[chord.degree] || 0;
          (audioEngine as any).playMelodyNote(
            {
              noteInfo: {
                degree: chord.degree,
                midi: pianoRoot,
                frequency: 440 * Math.pow(2, (pianoRoot - 69) / 12),
                label: `${chord.degree} (${pianoRoot})`,
              },
              startTime: beat,
              duration: chordDuration,
            },
            time + latency,
            false
          );
        }

        Tone.Draw.schedule(() => {
          if (!document.hidden) {
            setActiveChordIndex(index);
            setActiveRootMidi(triad[0]);
          }
        }, time);
      }, chordTime);

      beat += chordDuration;
    });

    // Clear visualizer after last chord
    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => {
        if (!document.hidden) {
          setActiveChordIndex(null);
          setActiveRootMidi(null);
        }
      }, time);
    }, passStartTime + beat * beatSec);
  };

  // ── Anchor time (always include one settling measure) ───────────────────────
  let anchorTime: number;
  if (isFirst) {
    const now = Tone.Transport.seconds;
    anchorTime = now < 0.1 ? 0 : Math.ceil(now / measureSec) * measureSec;
  } else {
    const now = Tone.Transport.seconds;
    const provided = startTime ?? now;
    anchorTime = provided < now + 0.1
      ? Math.ceil((now + 0.1) / measureSec) * measureSec
      : provided;
  }

  const safeStartTime = anchorTime + measureSec; // always 1 full settling measure

  // Show "Settling In..." during buffer measure
  Tone.Transport.schedule((time) => {
    Tone.Draw.schedule(() => {
      if (!document.hidden) {
        setStatus("Settling In...");
        setActiveChordIndex(null);
        setActiveRootMidi(null);
      }
    }, time);
  }, anchorTime);

  // ── Schedule 4 passes ───────────────────────────────────────────────────────
  schedulePass(safeStartTime,                          false, "Listen");
  schedulePass(safeStartTime + progressionDuration,    false, "Listen (Again)");
  schedulePass(safeStartTime + progressionDuration * 2, true, "Sing Along");
  schedulePass(safeStartTime + progressionDuration * 3, false, "Affirm");

  const cycleEndTime = safeStartTime + progressionDuration * 4;
  const nextCycleStart = Math.ceil((cycleEndTime + beatSec * 2) / measureSec) * measureSec;

  // "Next..." status between cycles
  Tone.Transport.schedule((time) => {
    Tone.Draw.schedule(() => {
      if (!document.hidden) {
        setStatus("Next...");
        setActiveChordIndex(null);
        setActiveRootMidi(null);
      }
    }, time);
  }, cycleEndTime);

  // Schedule next cycle
  Tone.Transport.schedule(() => {
    if (!isPlayingRef.current) return;
    questionCount.current++;
    runCycle(cycleKey, false, nextCycleStart);
  }, nextCycleStart - 0.05);

  if (isFirst) audioEngine.startPlayback();
}