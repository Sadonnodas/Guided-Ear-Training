import * as Tone from "tone";
import type { MusicalKey, ScaleDegree, ScaleType, NoteInfo } from "../types";

const ROOT_MIDI: Record<MusicalKey, number> = {
  "C": 48, "Cs": 49, "D": 50, "Ds": 51, "E": 52, "F": 53,
  "Fs": 54, "G": 55, "Gs": 56, "A": 57, "As": 58, "B": 59
};

const DEGREE_TO_SEMITONE: Record<ScaleDegree, number> = {
  "1": 0, "b2": 1, "2": 2, "b3": 3, "3": 4, "4": 5, "#4": 6, 
  "5": 7, "b6": 8, "6": 9, "b7": 10, "7": 11
};

const SCALES: Record<ScaleType, { degrees: ScaleDegree[], intervals: number[] }> = {
  Major: {
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
    intervals: [0, 2, 4, 5, 7, 9, 11]
  },
  Minor: {
    degrees: ["1", "2", "b3", "4", "5", "b6", "b7"],
    intervals: [0, 2, 3, 5, 7, 8, 10]
  },
  PentatonicMajor: {
    degrees: ["1", "2", "3", "5", "6"],
    intervals: [0, 2, 4, 7, 9]
  },
  PentatonicMinor: {
    degrees: ["1", "b3", "4", "5", "b7"],
    intervals: [0, 3, 5, 7, 10]
  },
  Chromatic: {
    degrees: ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"],
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  }
};

const MIN_MIDI = 43; // G2
const MAX_MIDI = 67; // G4 (Increased slightly to allow 1->5 up from C)

export function getNoteForDegree(
  key: MusicalKey,
  degree: ScaleDegree,
  _scaleType: ScaleType, 
  previousMidi: number | null = null
): NoteInfo {
  const rootMidi = ROOT_MIDI[key];
  const interval = DEGREE_TO_SEMITONE[degree]; 
  
  let targetMidi = rootMidi + interval;

  if (previousMidi !== null) {
    const candidates = [targetMidi - 12, targetMidi, targetMidi + 12];
    
    // 1. Filter by Absolute Vocal Range
    let valid = candidates.filter(m => m >= MIN_MIDI && m <= MAX_MIDI);

    // 2. Filter by Singability (Don't jump more than an octave)
    // If we have options, filter down. If not, we take what we can get.
    const strictValid = valid.filter(m => Math.abs(m - previousMidi) <= 12);
    if (strictValid.length > 0) {
        valid = strictValid;
    }

    if (valid.length > 0) {
      // FIX: Pick RANDOMLY from valid options instead of always picking the closest.
      // This allows 1->5 to go UP (7 semitones) or DOWN (5 semitones).
      targetMidi = valid[Math.floor(Math.random() * valid.length)];
    }
  } else {
    // Initial note placement logic
    if (targetMidi < 48) targetMidi += 12;
    if (targetMidi > 60) targetMidi -= 12;
  }

  // Final Safety Clamp
  if (targetMidi < MIN_MIDI) targetMidi += 12;
  if (targetMidi > MAX_MIDI) targetMidi -= 12;

  return {
    degree,
    midi: targetMidi,
    frequency: Tone.Frequency(targetMidi, "midi").toFrequency(),
    label: Tone.Frequency(targetMidi, "midi").toNote()
  };
}

export function getAvailableDegrees(scaleType: ScaleType): ScaleDegree[] {
  return SCALES[scaleType].degrees;
}

export function getScaleStepsFromRoot(midi: number, key: MusicalKey, scaleType: ScaleType): number {
  const rootMidi = ROOT_MIDI[key];
  const semitoneDiff = midi - rootMidi;
  const remainder = ((semitoneDiff % 12) + 12) % 12; 

  const degreeLabels = Object.keys(DEGREE_TO_SEMITONE) as ScaleDegree[];
  const degree = degreeLabels.find(d => DEGREE_TO_SEMITONE[d] === remainder) || "1";
  
  const scaleDef = SCALES[scaleType];
  let stepIndex = scaleDef.degrees.indexOf(degree);
  
  if (stepIndex === -1) {
      stepIndex = remainder; 
  }

  const octaves = Math.floor(semitoneDiff / 12);
  return (octaves * scaleDef.degrees.length) + stepIndex;
}

export function getDegreeLabelFromStep(stepIndex: number, scaleType: ScaleType): string {
    const scaleDef = SCALES[scaleType];
    const len = scaleDef.degrees.length;
    const wrappedIndex = ((stepIndex % len) + len) % len;
    return scaleDef.degrees[wrappedIndex];
}