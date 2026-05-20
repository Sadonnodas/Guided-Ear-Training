import * as Tone from "tone";
import { audioEngine } from "../audio/AudioEngine.ts";
import {
  generateChordProgression,
  generateModulationProgression,
  getChordMidiNotes,
  type ChordProgression,
} from "../core/ChordProgressionGenerator.ts";
import { LATENCY_OFFSET } from "../config/AudioConfig.ts";
import type { MusicalKey, ScaleDegree, ScaleType } from "../types.ts";
import { KEYS, KEY_DISPLAY_MAP } from "./sessionConstants.ts";

export interface ProgressionsCycleDeps {
  isPlayingRef: React.MutableRefObject<boolean>;
  questionCount: React.MutableRefObject<number>;
  currentProgression: React.MutableRefObject<ChordProgression | null>;

  settings: {
    refs: {
      bpm: React.MutableRefObject<number>;
      questionsPerKey: React.MutableRefObject<number>;
      startRoot: React.MutableRefObject<boolean>;
      endRoot: React.MutableRefObject<boolean>;
      includeSevenths: React.MutableRefObject<boolean>;
      enabledInversions: React.MutableRefObject<number[]>;
      minVocalMidi: React.MutableRefObject<number>;
      maxVocalMidi: React.MutableRefObject<number>;
    };
  };

  scaleTypeRef: React.MutableRefObject<ScaleType>;
  enabledDegreesRef: React.MutableRefObject<ScaleDegree[]>;
  focusedDegreesRef: React.MutableRefObject<ScaleDegree[]>;

  setStatus: (s: string) => void;
  setCurrentKey: (k: MusicalKey) => void;
  setVisualizerKey: (k: MusicalKey) => void;
  setActiveChordIndex: (i: number | null) => void;
  setActiveRootMidi: (m: number | null) => void;

  runCycle: (key: MusicalKey, isFirst: boolean, startTime?: number) => void;
}

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

  if (isFirst) {
    setActiveChordIndex(null);
    setActiveRootMidi(null);
  }

  // Auto-modulation
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

  // Generate progression
  let progression: ChordProgression;

  if (forceSettle) {
    progression = generateModulationProgression(
      cycleKey,
      scaleTypeRef.current,
      settings.refs.minVocalMidi.current,
      settings.refs.maxVocalMidi.current
    );
    setStatus("New Key: I-III-V-I");
  } else {
    progression = generateChordProgression({
      key: cycleKey,
      scaleType: scaleTypeRef.current,
      startOnOne: settings.refs.startRoot.current,
      endOnOne: settings.refs.endRoot.current,
      includeSevenths: settings.refs.includeSevenths.current,
      enabledInversions: settings.refs.enabledInversions.current,
      minMidi: settings.refs.minVocalMidi.current,
      maxMidi: settings.refs.maxVocalMidi.current,
      enabledDegrees: enabledDegreesRef.current,
      focusedDegrees: focusedDegreesRef.current,
    });
  }

  currentProgression.current = progression;

  // Preload samples
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

  // Preload vocal samples for Sing Along pass
  const vocalNoteEvents = progression.chords.map(chord => {
    const { root } = getChordMidiNotes(
      chord, cycleKey,
      settings.refs.minVocalMidi.current,
      settings.refs.maxVocalMidi.current
    );
    const pianoRoot = root;
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
  console.log(`Chord samples preloaded in ${(performance.now() - t0).toFixed(0)}ms`);
  if (!isPlayingRef.current) return;

  // Timing constants
  const beatSec = 60 / settings.refs.bpm.current;
  const measureSec = 4 * beatSec;
  const chordDuration = 2;
  const progressionDuration = progression.chords.length * chordDuration * beatSec;

  // schedulePass helper
  const schedulePass = (passStartTime: number, playVocals: boolean, label: string) => {
    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => { if (!document.hidden) setStatus(label); }, time);
    }, passStartTime);

    let beat = 0;
    progression.chords.forEach((chord, index) => {
      const chordTime = passStartTime + beat * beatSec;
      const { bass, root, triad } = getChordMidiNotes(
        chord, cycleKey,
        settings.refs.minVocalMidi.current,
        settings.refs.maxVocalMidi.current
      );

      Tone.Transport.schedule((time) => {
        audioEngine.playChord(bass, triad, time);

        if (playVocals) {
          const pianoRoot = root;
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
            setActiveRootMidi(root);
          }
        }, time);
      }, chordTime);

      beat += chordDuration;
    });

    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => {
        if (!document.hidden) {
          setActiveChordIndex(null);
          setActiveRootMidi(null);
        }
      }, time);
    }, passStartTime + beat * beatSec);
  };

  // Anchor time
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

  const safeStartTime = anchorTime + measureSec;

  Tone.Transport.schedule((time) => {
    Tone.Draw.schedule(() => {
      if (!document.hidden) {
        setStatus("Settling In...");
        setActiveChordIndex(null);
        setActiveRootMidi(null);
      }
    }, time);
  }, anchorTime);

  // 4 passes
  schedulePass(safeStartTime,                           false, "Listen");
  schedulePass(safeStartTime + progressionDuration,     false, "Listen (Again)");
  schedulePass(safeStartTime + progressionDuration * 2, true,  "Sing Along");
  schedulePass(safeStartTime + progressionDuration * 3, false, "Affirm");

  const cycleEndTime = safeStartTime + progressionDuration * 4;

  // Snap to next measure boundary — next cycle adds its own settling bar,
  // giving exactly 1 bar between cycles instead of the previous 3.
  const nextCycleStart = Math.ceil(cycleEndTime / measureSec) * measureSec;

  Tone.Transport.schedule((time) => {
    Tone.Draw.schedule(() => {
      if (!document.hidden) {
        setStatus("Next...");
        setActiveChordIndex(null);
        setActiveRootMidi(null);
      }
    }, time);
  }, cycleEndTime);

  Tone.Transport.schedule(() => {
    if (!isPlayingRef.current) return;
    questionCount.current++;
    runCycle(cycleKey, false, nextCycleStart);
  }, nextCycleStart - 0.05);

  if (isFirst) audioEngine.startPlayback();
}