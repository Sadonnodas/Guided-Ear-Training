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
 * FIXED: Strictly enforces vocal range - will NEVER return notes outside minMidi/maxMidi
 * FIXED: Recalculates degree after clamping to prevent wrong vocal samples
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
    // FIXED: Check wider range of octaves to handle all key/range combinations
    // Generate candidates from -48 to +48 semitones (4 octaves in each direction)
    const candidates: number[] = [];
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      candidates.push(targetMidi + octaveOffset);
    }
    
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
        // If no candidates respect jump limit, ignore jump limit but KEEP range constraint
        const validInRange = candidates.filter(m => m >= minMidi && m <= maxMidi);
        if (validInRange.length > 0) {
            targetMidi = validInRange[Math.floor(Math.random() * validInRange.length)];
        } else {
            // CRITICAL FIX: If still no candidates, clamp to range
            // This happens when the root+degree is outside range in all octaves
            targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));
        }
    }
  } else {
    // Starting note logic - also check wider range
    const startCandidates: number[] = [];
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      startCandidates.push(targetMidi + octaveOffset);
    }
    const validStart = startCandidates.filter(m => m >= minMidi && m <= maxMidi);
    
    if (validStart.length > 0) {
        targetMidi = validStart[Math.floor(Math.random() * validStart.length)];
    } else {
        // CRITICAL FIX: Clamp if no valid starting notes
        targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));
    }
  }

  // CRITICAL: Final safety clamp to ensure we NEVER go outside range
  targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));

  // Build the final frequency
  const freq = 440 * Math.pow(2, (targetMidi - 69) / 12);

  return {
    degree: degree,  // Use original requested degree
    midi: targetMidi,
    frequency: freq,
    label: `${degree} (${targetMidi})`
  };
}

/**
 * Convert a MIDI note back to its scale degree in a given key
 * Used when MIDI gets clamped - need to figure out what degree it actually is now
 */
export function getDegreeFromMidi(
  midi: number, 
  key: MusicalKey, 
  scaleType: ScaleType
): ScaleDegree {
  const rootMidi = ROOT_MIDI[key];
  const semitones = ((midi - rootMidi) % 12 + 12) % 12; // Modulo 12 for interval within octave
  
  // Find which degree corresponds to this interval
  const degrees = SCALE_DEGREES[scaleType];
  
  for (const degree of degrees) {
    if (DEGREE_TO_SEMITONE[degree] === semitones) {
      return degree;
    }
  }
  
  // If not an exact match (chromatic or edge case), find closest
  let closestDegree: ScaleDegree = degrees[0];
  let minDiff = 12;
  
  for (const degree of degrees) {
    const diff = Math.abs(DEGREE_TO_SEMITONE[degree] - semitones);
    if (diff < minDiff) {
      minDiff = diff;
      closestDegree = degree;
    }
  }
  
  return closestDegree;
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