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
 * - Difficulty-based jump limits (STRICTLY ENFORCED)
 * - Vocal or fretboard range constraints
 * - Octave selection for smooth voice leading
 *
 * CRITICAL FIX: Now returns the ACTUAL degree that corresponds to the final MIDI note
 * This prevents the bug where vocal samples sing the wrong degree due to clamping
 */
export function getNoteForDegree(
  key: MusicalKey,
  degree: ScaleDegree,
  scaleType: ScaleType, 
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
    // Generate candidates from -48 to +48 semitones (4 octaves in each direction)
    const candidates: number[] = [];
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      candidates.push(targetMidi + octaveOffset);
    }
    
    // STRICT DIFFICULTY ENFORCEMENT
    let jumpLimit = 12;
    
    if (difficulty === "easiest") {
      // Easiest: Max interval is Major 3rd (4 semitones)
      // One perfect 5th (7 semitones) allowed per melody (tracked by hasLeaped)
      jumpLimit = hasLeaped ? 4 : 7;
    } else if (difficulty === "easy") {
      jumpLimit = 7; // Perfect 5th - NO EXCEPTIONS
    } else if (difficulty === "normal" && hasLeaped) {
      jumpLimit = 7;
    }
    // hard has no limit (jumpLimit = 12)

    // STEP 1: Find all candidates that respect BOTH range AND jump limit
    let valid = candidates.filter(m => {
        const withinRange = m >= minMidi && m <= maxMidi;
        const jumpDist = Math.abs(m - previousMidi);
        return withinRange && jumpDist <= jumpLimit;
    });

    // STEP 2: Choose among valid candidates, biased by difficulty.
    // The candidates are sorted closest-first; easier difficulties favour the
    // closest note (small steps), harder difficulties favour the larger leaps.
    // Without this bias, every difficulty just picked the closest note and the
    // higher jump limits were never actually exercised.
    if (valid.length > 0) {
      valid.sort((a, b) => Math.abs(a - previousMidi) - Math.abs(b - previousMidi));

      // Exponent < 1 skews the pick toward larger jumps, > 1 toward smaller.
      const biasExp =
        difficulty === "easiest" ? 4.0 :
        difficulty === "easy"    ? 2.2 :
        difficulty === "hard"    ? 0.45 :
        1.0; // normal — roughly uniform across the valid range

      const skewed = Math.pow(Math.random(), biasExp);
      const idx = Math.min(valid.length - 1, Math.floor(skewed * valid.length));
      targetMidi = valid[idx];
    } else {
      // STEP 3: NO VALID CANDIDATES
      // This means we cannot play this degree without violating difficulty rules
      // SOLUTION: Stay on the same note (repeat previous) to maintain melodic flow
      // This is better than breaking difficulty rules or going out of range
      console.warn(`Cannot play degree ${degree} in key ${key} within range ${minMidi}-${maxMidi} and difficulty ${difficulty}. Repeating previous note.`);
      targetMidi = previousMidi;
    }
  } else {
    // Starting note logic - also check wider range
    const startCandidates: number[] = [];
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      startCandidates.push(targetMidi + octaveOffset);
    }
    const validStart = startCandidates.filter(m => m >= minMidi && m <= maxMidi);
    
    if (validStart.length > 0) {
        // Prefer middle of range for starting notes
        validStart.sort((a, b) => {
          const midRange = (minMidi + maxMidi) / 2;
          return Math.abs(a - midRange) - Math.abs(b - midRange);
        });
        targetMidi = validStart[0];
    } else {
        // CRITICAL FIX: Clamp if no valid starting notes
        targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));
    }
  }

  // CRITICAL: Final safety clamp to ensure we NEVER go outside range
  targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));

  // *** CRITICAL FIX: Calculate the ACTUAL degree for this MIDI note ***
  // This prevents the bug where we play MIDI 60 but call it degree "3"
  const actualDegree = getDegreeFromMidi(targetMidi, key, scaleType);
  
  // Build the final frequency
  const freq = 440 * Math.pow(2, (targetMidi - 69) / 12);

  return {
    degree: actualDegree,  // Use ACTUAL degree, not requested degree
    midi: targetMidi,
    frequency: freq,
    label: `${actualDegree} (${targetMidi})`
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