import { useState, useEffect, useRef } from "react";
import { audioEngine } from "../audio/AudioEngine";
import type { MelodyDifficulty, CagedShape} from "../types";

export function useSessionSettings() {
  // --- STATE ---
  const [bpm, setBpm] = useState(80);
  const [currentPattern, setCurrentPattern] = useState("Lofi Chill");
  
  const [startRoot, setStartRoot] = useState(true);
  const [endRoot, setEndRoot] = useState(false);
  const [silentPractice, setSilentPractice] = useState(true);
  const [trainingWheels, setTrainingWheels] = useState(false);
  const [inverseMode, setInverseMode] = useState(false);
  const [questionsPerKey, setQuestionsPerKey] = useState(10);
  const [difficulty, setDifficulty] = useState<MelodyDifficulty>("easy");
  const [selectedShape, setSelectedShape] = useState<CagedShape>("E");
  const [hideFretboardVisuals, setHideFretboardVisuals] = useState(false);
  const [includeDiminished, setIncludeDiminished] = useState(false); // NEW: For progressions mode
  
  // NEW: Vocal Range State
  const [minVocalMidi, setMinVocalMidi] = useState(43); // G2 - default vocal range min
  const [maxVocalMidi, setMaxVocalMidi] = useState(67); // G4 - default vocal range max

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
    includeDiminished: useRef(includeDiminished), // NEW
    minVocalMidi: useRef(minVocalMidi), // NEW
    maxVocalMidi: useRef(maxVocalMidi), // NEW
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
  useEffect(() => { refs.includeDiminished.current = includeDiminished; }, [includeDiminished]); // NEW
  useEffect(() => { refs.minVocalMidi.current = minVocalMidi; }, [minVocalMidi]); // NEW
  useEffect(() => { refs.maxVocalMidi.current = maxVocalMidi; }, [maxVocalMidi]); // NEW

  const setPattern = (name: string) => {
    setCurrentPattern(name);
    audioEngine.setDrumPattern(name);
  };

  return {
    // Values
    bpm, currentPattern, startRoot, endRoot, silentPractice, 
    trainingWheels, inverseMode, questionsPerKey, difficulty,
    selectedShape, hideFretboardVisuals, includeDiminished, // NEW: includeDiminished
    minVocalMidi, maxVocalMidi, // NEW
    
    // Setters
    setBpm, setPattern, setStartRoot, setEndRoot, setSilentPractice,
    setTrainingWheels, setInverseMode, setQuestionsPerKey, setDifficulty,
    setSelectedShape, setHideFretboardVisuals, setIncludeDiminished, // NEW: setIncludeDiminished
    setMinVocalMidi, setMaxVocalMidi, // NEW
    
    // Refs (Expose these to the game loop)
    refs
  };
}