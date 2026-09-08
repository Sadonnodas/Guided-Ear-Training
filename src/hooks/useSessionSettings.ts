import { useEffect, useRef } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { DRUM_PATTERNS } from "../config/AudioConfig";
import { usePersistentState, asBool, asInt, asOneOf } from "./usePersistentState";
import type { MelodyDifficulty, CagedShape} from "../types";

const DIFFICULTIES: MelodyDifficulty[] = ["easiest", "easy", "normal", "hard"];
const SHAPES: CagedShape[] = ["C", "A", "G", "E", "D"];
const PATTERN_NAMES = Object.keys(DRUM_PATTERNS);

// Vocal sample range: G2 to G4. Anything outside it cannot be sung back.
const VOCAL_MIN = 43;
const VOCAL_MAX = 67;

export function useSessionSettings() {
  // --- STATE (all of it restored from the previous launch) ---
  const [bpm, setBpm] = usePersistentState("bpm", 80, asInt(30, 300));
  const [currentPattern, setCurrentPattern] = usePersistentState(
    "drumPattern", "Lofi Chill", asOneOf(PATTERN_NAMES),
  );

  const [startRoot, setStartRoot] = usePersistentState("startRoot", true, asBool);
  const [endRoot, setEndRoot] = usePersistentState("endRoot", false, asBool);
  const [silentPractice, setSilentPractice] = usePersistentState("silentPractice", true, asBool);
  const [trainingWheels, setTrainingWheels] = usePersistentState("trainingWheels", false, asBool);
  const [inverseMode, setInverseMode] = usePersistentState("inverseMode", false, asBool);
  const [questionsPerKey, setQuestionsPerKey] = usePersistentState("questionsPerKey", 10, asInt(1, 50));
  const [difficulty, setDifficulty] = usePersistentState<MelodyDifficulty>(
    "difficulty", "easy", asOneOf(DIFFICULTIES),
  );
  const [selectedShape, setSelectedShape] = usePersistentState<CagedShape>(
    "cagedShape", "E", asOneOf(SHAPES),
  );
  const [hideFretboardVisuals, setHideFretboardVisuals] = usePersistentState(
    "hideFretboardVisuals", false, asBool,
  );
  // Progressions mode: 7th chords toggle + allowed chord inversions (0=root, 1=1st, 2=2nd)
  const [includeSevenths, setIncludeSevenths] = usePersistentState("includeSevenths", false, asBool);
  const [enabledInversions, setEnabledInversions] = usePersistentState<number[]>(
    "enabledInversions", [0],
    (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return undefined;
      const kept = raw.filter((v): v is number => v === 0 || v === 1 || v === 2);
      return kept.length === raw.length ? kept : undefined;
    },
  );
  // What instrument plays anywhere the synth would normally play (fretboard
  // melodies, pitch guide, out-of-vocal-range fallback). Piano falls back to
  // synth for notes outside the piano sample range (23-67).
  const [playbackSound, setPlaybackSound] = usePersistentState<'synth' | 'piano'>(
    "playbackSound", 'synth', asOneOf(['synth', 'piano'] as const),
  );

  // Vocal Range
  const [minVocalMidi, setMinVocalMidi] = usePersistentState(
    "minVocalMidi", 43, asInt(VOCAL_MIN, VOCAL_MAX), // G2 - default vocal range min
  );
  const [maxVocalMidi, setMaxVocalMidi] = usePersistentState(
    "maxVocalMidi", 67, asInt(VOCAL_MIN, VOCAL_MAX), // G4 - default vocal range max
  );

  // --- REFS (For access inside the async Game Loop) ---
  const refs = {
    bpm: useRef(bpm),
    startRoot: useRef(startRoot),
    endRoot: useRef(endRoot),
    silentPractice: useRef(silentPractice),
    trainingWheels: useRef(trainingWheels),
    inverseMode: useRef(inverseMode),
    questionsPerKey: useRef(questionsPerKey),
    difficulty: useRef(difficulty),
    selectedShape: useRef(selectedShape),
    hideFretboardVisuals: useRef(hideFretboardVisuals),
    includeSevenths: useRef(includeSevenths),
    enabledInversions: useRef(enabledInversions),
    playbackSound: useRef(playbackSound),
    minVocalMidi: useRef(minVocalMidi),
    maxVocalMidi: useRef(maxVocalMidi),
  };

  // --- SYNC REFS & ENGINE ---
  useEffect(() => { refs.bpm.current = bpm; audioEngine.setBpm(bpm); }, [bpm]);
  useEffect(() => { refs.startRoot.current = startRoot; }, [startRoot]);
  useEffect(() => { refs.endRoot.current = endRoot; }, [endRoot]);
  useEffect(() => { refs.silentPractice.current = silentPractice; }, [silentPractice]);
  useEffect(() => { refs.trainingWheels.current = trainingWheels; }, [trainingWheels]);
  useEffect(() => { refs.inverseMode.current = inverseMode; }, [inverseMode]);
  useEffect(() => { refs.questionsPerKey.current = questionsPerKey; }, [questionsPerKey]);
  useEffect(() => { refs.difficulty.current = difficulty; }, [difficulty]);
  useEffect(() => { refs.selectedShape.current = selectedShape; }, [selectedShape]);
  useEffect(() => { refs.hideFretboardVisuals.current = hideFretboardVisuals; }, [hideFretboardVisuals]);
  useEffect(() => { refs.includeSevenths.current = includeSevenths; }, [includeSevenths]);
  useEffect(() => { refs.enabledInversions.current = enabledInversions; }, [enabledInversions]);
  useEffect(() => { refs.playbackSound.current = playbackSound; }, [playbackSound]);
  useEffect(() => { refs.minVocalMidi.current = minVocalMidi; }, [minVocalMidi]);
  useEffect(() => { refs.maxVocalMidi.current = maxVocalMidi; }, [maxVocalMidi]);

  const setPattern = (name: string) => {
    setCurrentPattern(name);
    audioEngine.setDrumPattern(name);
  };

  return {
    // Values
    bpm, currentPattern, startRoot, endRoot, silentPractice, 
    trainingWheels, inverseMode, questionsPerKey, difficulty,
    selectedShape, hideFretboardVisuals, includeSevenths, enabledInversions,
    playbackSound,
    minVocalMidi, maxVocalMidi,

    // Setters
    setBpm, setPattern, setStartRoot, setEndRoot, setSilentPractice,
    setTrainingWheels, setInverseMode, setQuestionsPerKey, setDifficulty,
    setSelectedShape, setHideFretboardVisuals, setIncludeSevenths, setEnabledInversions,
    setPlaybackSound,
    setMinVocalMidi, setMaxVocalMidi,
    
    // Refs (Expose these to the game loop)
    refs
  };
}
