import * as Tone from "tone";
import type { MusicalKey, ScaleDegree, ScaleType, NoteInfo } from "../types";

// Adjusted for Male Vocals (C3 = 48)
const ROOT_MIDI: Record<MusicalKey, number> = {
  "C": 48, "Cs": 49, "D": 50, "Ds": 51, "E": 52, "F": 53,
  "Fs": 54, "G": 55, "Gs": 56, "A": 57, "As": 58, "B": 59
};

const SCALES: Record<ScaleType, { degrees: ScaleDegree[], intervals: number[] }> = {
  Major: {
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
    intervals: [0, 2, 4, 5, 7, 9, 11]
  },
  Minor: {
    degrees: ["1", "2", "3", "4", "5", "6", "7"],
    intervals: [0, 2, 3, 5, 7, 8, 10]
  },
  PentatonicMajor: {
    degrees: ["1", "2", "3", "5", "6"],
    intervals: [0, 2, 4, 7, 9]
  },
  PentatonicMinor: {
    degrees: ["1", "3", "4", "5", "7"],
    intervals: [0, 3, 5, 7, 10]
  }
};

// Range Constraints (Male Range approx G2 - E4)
const MIN_MIDI = 43; // G2
const MAX_MIDI = 64; // E4

export function getNoteForDegree(
  key: MusicalKey,
  degree: ScaleDegree,
  scaleType: ScaleType,
  previousMidi: number | null = null
): NoteInfo {
  const rootMidi = ROOT_MIDI[key];
  const scaleDef = SCALES[scaleType];
  
  const degreeIndex = scaleDef.degrees.indexOf(degree);
  if (degreeIndex === -1) throw new Error(`Degree ${degree} not found`);

  const interval = scaleDef.intervals[degreeIndex];
  
  // Calculate candidate
  let targetMidi = rootMidi + interval;

  // --- SMART OCTAVE LOGIC ---
  // If we have a previous note, try to stay close to it
  if (previousMidi !== null) {
    const candidates = [targetMidi - 12, targetMidi, targetMidi + 12];
    
    // Find valid candidates within range
    const valid = candidates.filter(m => m >= MIN_MIDI && m <= MAX_MIDI);
    
    if (valid.length > 0) {
      // Pick closest
      targetMidi = valid.reduce((prev, curr) => 
        Math.abs(curr - previousMidi) < Math.abs(prev - previousMidi) ? curr : prev
      );
    }
  } else {
    // First note: Center it
    if (targetMidi < 48) targetMidi += 12;
    if (targetMidi > 60) targetMidi -= 12;
  }

  // Hard Clamp
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