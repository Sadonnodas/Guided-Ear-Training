import type { MusicalKey, ScaleDegree, ScaleType, NoteInfo, MelodyDifficulty } from "../types";

// --- Root notes in MIDI ---
const ROOT_MIDI: Record<MusicalKey, number> = {
  "C": 60, "Cs": 61, "D": 62, "Ds": 63,
  "E": 64, "F": 65, "Fs": 66, "G": 67,
  "Gs": 68, "A": 69, "As": 70, "B": 71
};

// --- Global vocal range constraints (used as default) ---
const DEFAULT_MIN_MIDI = 43; // G2 - lowest sample
const DEFAULT_MAX_MIDI = 67; // G4 - highest sample

// --- Degree to Semitone Mapping ---
const DEGREE_TO_SEMITONE: Record<ScaleDegree, number> = {
  "1": 0, "b2": 1, "2": 2, "b3": 3,
  "3": 4, "4": 5, "#4": 6, "5": 7,
  "b6": 8, "6": 9, "b7": 10, "7": 11
};

// --- Define Which Notes Exist in Each Scale ---
const SCALE_DEGREES: Record<ScaleType, ScaleDegree[]> = {
  "Major": ["1", "2", "3", "4", "5", "6", "7"],
  "Minor": ["1", "2", "b3", "4", "5", "b6", "b7"],
  "PentatonicMajor": ["1", "2", "3", "5", "6"],
  "PentatonicMinor": ["1", "b3", "4", "5", "b7"],
  "Chromatic": ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"]
};

/**
 * Get a valid MIDI note for a given degree, respecting:
 * - Difficulty-based jump limits
 * - Vocal or fretboard range constraints
 * - Octave selection for smooth voice leading
 *
 * ENHANCED: Now supports "easiest" difficulty with strict interval limits
 */
export function getNoteForDegree(
  key: MusicalKey,
  degree: ScaleDegree,
  _scaleType: ScaleType, 
  previousMidi: number | null = null,
  difficulty: MelodyDifficulty = "normal",
  hasLeaped: boolean = false,
  minLimit?: number,
  maxLimit?: number
): NoteInfo {
  const rootMidi = ROOT_MIDI[key];
  const interval = DEGREE_TO_SEMITONE[degree]; 
  
  const minMidi = minLimit ?? DEFAULT_MIN_MIDI;
  const maxMidi = maxLimit ?? DEFAULT_MAX_MIDI;

  let targetMidi = rootMidi + interval;

  if (previousMidi !== null) {
    const candidates = [targetMidi - 12, targetMidi, targetMidi + 12];
    
    let jumpLimit = 12;
    
    // DIFFICULTY SETTINGS
    if (difficulty === "easiest") {
      // Easiest: Max interval is Major 3rd (4 semitones)
      // One perfect 5th (7 semitones) allowed per melody (tracked by hasLeaped)
      jumpLimit = hasLeaped ? 4 : 7;
    } else if (difficulty === "easy") {
      jumpLimit = 7; // Perfect 5th
    } else if (difficulty === "normal" && hasLeaped) {
      jumpLimit = 7;
    }
    // hard has no limit (jumpLimit = 12)

    let valid = candidates.filter(m => {
        const withinRange = m >= minMidi && m <= maxMidi;
        const jumpDist = Math.abs(m - previousMidi);
        return withinRange && jumpDist <= jumpLimit;
    });

    if (valid.length > 0) {
      targetMidi = valid[Math.floor(Math.random() * valid.length)];
    } else {
        const validInRange = candidates.filter(m => m >= minMidi && m <= maxMidi);
        if (validInRange.length > 0) {
            targetMidi = validInRange[Math.floor(Math.random() * validInRange.length)];
        }
    }
  } else {
    // Starting note logic
    const startCandidates = [targetMidi - 12, targetMidi, targetMidi + 12];
    const validStart = startCandidates.filter(m => m >= minMidi && m <= maxMidi);
    
    if (validStart.length > 0) {
        targetMidi = validStart[Math.floor(Math.random() * validStart.length)];
    }
  }

  // Build the final frequency
  const freq = 440 * Math.pow(2, (targetMidi - 69) / 12);

  return {
    degree,
    midi: targetMidi,
    frequency: freq,
    label: `${degree} (${targetMidi})`
  };
}

/**
 * Convert a step offset from root note to the corresponding scale degree
 */
export function getDegreeLabelFromStep(step: number, scaleType: ScaleType): ScaleDegree {
  const degrees = SCALE_DEGREES[scaleType];
  const index = ((step % degrees.length) + degrees.length) % degrees.length;
  return degrees[index];
}

/**
 * Get steps from root for a given MIDI note
 */
export function getScaleStepsFromRoot(midi: number, rootNote: MusicalKey, scaleType: ScaleType): number {
  const rootMidi = ROOT_MIDI[rootNote];
  const semitones = midi - rootMidi;
  const degrees = SCALE_DEGREES[scaleType];
  
  const allSemitones = degrees.map(d => DEGREE_TO_SEMITONE[d]);
  
  let bestMatch = 0;
  let minDiff = Infinity;
  
  for (let octaveShift = -3; octaveShift <= 3; octaveShift++) {
    for (let i = 0; i < allSemitones.length; i++) {
      const candidateSemitones = allSemitones[i] + (octaveShift * 12);
      const diff = Math.abs(candidateSemitones - semitones);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = i + (octaveShift * degrees.length);
      }
    }
  }
  
  return bestMatch;
}

/**
 * Get all available degrees for a given scale
 */
export function getAvailableDegrees(scaleType: ScaleType): ScaleDegree[] {
  return SCALE_DEGREES[scaleType];
}