import type { MusicalKey } from "../types";

export const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];

export const KEY_DISPLAY_MAP: Record<MusicalKey, string> = {
  "C": "C",  "Cs": "D♭", "D": "D",  "Ds": "E♭",
  "E": "E",  "F": "F",   "Fs": "F♯","G": "G",
  "Gs": "A♭","A": "A",   "As": "B♭","B": "B",
};

export const TAB_DEFAULTS: Record<string, {
  inverseMode: boolean;
  trainingWheels: boolean;
  hideFretboardVisuals: boolean;
}> = {
  random:       { inverseMode: false, trainingWheels: false, hideFretboardVisuals: false },
  training:     { inverseMode: false, trainingWheels: false, hideFretboardVisuals: false },
  fretboard:    { inverseMode: true,  trainingWheels: false, hideFretboardVisuals: false },
  progressions: { inverseMode: false, trainingWheels: false, hideFretboardVisuals: false },
};