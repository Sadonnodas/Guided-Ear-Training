import { getNoteForDegree } from "../audio/MusicTheory";
import type { NoteEvent, MusicalKey, ScaleType, ScaleDegree, MelodyConstraints, MelodyDifficulty } from "../types";

interface GeneratorOptions {
  key: MusicalKey;
  scaleType: ScaleType;
  constraints: MelodyConstraints;
}

// --- Root notes in MIDI (duplicated from MusicTheory.ts for range checking) ---
const ROOT_MIDI: Record<MusicalKey, number> = {
  "C": 60, "Cs": 61, "D": 62, "Ds": 63,
  "E": 64, "F": 65, "Fs": 66, "G": 67,
  "Gs": 68, "A": 69, "As": 70, "B": 71
};

const DEGREE_TO_SEMITONE: Record<ScaleDegree, number> = {
  "1": 0, "b2": 1, "2": 2, "b3": 3,
  "3": 4, "4": 5, "#4": 6, "5": 7,
  "b6": 8, "6": 9, "b7": 10, "7": 11
};

/**
 * Check if a degree can be played within the vocal range
 * A degree is playable if at least one octave of it fits within minMidi to maxMidi
 * 
 * FIXED: Now checks a wider range of octaves to handle all key/range combinations
 */
function isDegreePlayableInRange(
  degree: ScaleDegree,
  key: MusicalKey,
  minMidi: number,
  maxMidi: number
): boolean {
  const rootMidi = ROOT_MIDI[key];
  const interval = DEGREE_TO_SEMITONE[degree];
  
  // Calculate base pitch (degree relative to root)
  const basePitch = rootMidi + interval;
  
  // Check octaves from very low to very high (covers full MIDI range)
  // This ensures we find the note even if root is in a high octave
  for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
    const candidate = basePitch + octaveOffset;
    if (candidate >= minMidi && candidate <= maxMidi) {
      return true; // Found at least one playable octave
    }
  }
  
  return false; // No octaves of this degree fit in range
}

export function generateMelody(options: GeneratorOptions): NoteEvent[] {
  const { key, scaleType, constraints } = options;
  const { allowedDegrees, focusedDegrees, startDegree, endDegree, length } = constraints;
  
  // CRITICAL FIX: Filter allowed degrees to only those playable in the current vocal range
  const minMidi = constraints.minMidi ?? 43; // Default vocal range
  const maxMidi = constraints.maxMidi ?? 67;
  
  const playableDegrees = allowedDegrees.filter(degree => 
    isDegreePlayableInRange(degree, key, minMidi, maxMidi)
  );
  
  // Safety: If no degrees are playable (shouldn't happen), fall back to "1"
  if (playableDegrees.length === 0) {
    console.warn(`No degrees playable in range ${minMidi}-${maxMidi} for key ${key}. Falling back to degree "1".`);
    playableDegrees.push("1");
  }
  
  // 1. Initialize empty slots
  const degrees: (ScaleDegree | null)[] = new Array(length).fill(null);
  
  // 2. Set Constraints (Start/End)
  // Only set them if they are in the playable list
  if (startDegree && playableDegrees.includes(startDegree)) {
      degrees[0] = startDegree;
  }
  if (endDegree && playableDegrees.includes(endDegree)) {
      degrees[length - 1] = endDegree;
  }

  // 3. Handle Focused Degrees (NEW LOGIC)
  // We need to forcibly insert these into the NULL slots.
  if (focusedDegrees && focusedDegrees.length > 0) {
      // Create a shuffled copy of focus requirements to randomize insertion order
      const focusPool = [...focusedDegrees].sort(() => Math.random() - 0.5);
      
      // Get all currently empty indices
      let emptyIndices = degrees
          .map((val, idx) => val === null ? idx : -1)
          .filter(idx => idx !== -1);
      
      // Shuffle the indices so the focused notes appear in random positions
      emptyIndices.sort(() => Math.random() - 0.5);

      // Place focused notes into the empty slots
      // SAFEGUARD: Ensure focused note is playable in current range
      const validFocusPool = focusPool.filter(d => playableDegrees.includes(d));
      
      while (validFocusPool.length > 0 && emptyIndices.length > 0) {
          const note = validFocusPool.pop()!;
          const idx = emptyIndices.pop()!;
          degrees[idx] = note;
      }
  }

  // 4. Fill remaining slots randomly from Playable Degrees
  const pool: ScaleDegree[] = playableDegrees.length > 0 ? playableDegrees : ["1"];
  
  for (let i = 0; i < length; i++) {
      // Only fill if the slot wasn't already taken by Start, End, or Focus
      if (degrees[i] === null) {
          let candidatePool = [...pool];

          // Simple Repetition Guard: Avoid 3 identical notes in a row
          // We only check this if we are generating a new note. 
          // (If a Focused note creates a triplet, we allow it because Focus is higher priority).
          if (i >= 2) {
              const prev1 = degrees[i-1];
              const prev2 = degrees[i-2];
              if (prev1 && prev2 && prev1 === prev2) {
                  candidatePool = candidatePool.filter(d => d !== prev1);
                  // If we filtered everything out (impossible if pool > 1), reset
                  if (candidatePool.length === 0) candidatePool = [...pool];
              }
          }
          
          degrees[i] = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      }
  }

  // 5. Convert abstract degrees to playable NoteEvents
  const melody: NoteEvent[] = [];
  let currentBeat = 0;
  let lastMidi: number | null = null;
  let hasLeaped = false; // Internal flag to track if we've already done a big leap
  const noteDur = 2; 

  degrees.forEach(d => {
      const safeDegree = d || "1"; 
      
      // Pass the difficulty and current leap status
      const event = createEvent(safeDegree, key, scaleType, currentBeat, noteDur, lastMidi, constraints.difficulty || "normal", hasLeaped, constraints);

      // If this specific note created a leap > 7 semitones, trip the flag
      if (lastMidi !== null && Math.abs(event.noteInfo.midi - lastMidi) > 7) {
          hasLeaped = true;
      }

      melody.push(event);
      currentBeat += noteDur;
      lastMidi = event.noteInfo.midi;
  });

  return melody;
}

/**
 * Generates a specific, pre-defined pattern (used for training levels/intros)
 */
export function generateFixedPattern(
  pattern: ScaleDegree[], 
  key: MusicalKey, 
  scaleType: ScaleType,
  minMidi?: number,
  maxMidi?: number
): NoteEvent[] {
    const melody: NoteEvent[] = [];
    let currentBeat = 0;
    let lastMidi: number | null = null;
    
    pattern.forEach(degree => {
        const duration = 2; 
        const event = createEvent(
          degree, 
          key, 
          scaleType, 
          currentBeat, 
          duration, 
          lastMidi,
          "normal",
          false,
          minMidi && maxMidi ? { minMidi, maxMidi } as MelodyConstraints : undefined
        );
        melody.push(event);
        currentBeat += duration;
        lastMidi = event.noteInfo.midi;
    });

    return melody;
}

/**
 * Helper to create the NoteEvent object with correct MIDI pitch
 * 
 * ENHANCED: Now properly uses minMidi/maxMidi from constraints when provided
 * This allows fretboard mode to work with its specific range while still
 * getting hybrid vocal/synth playback from the AudioEngine
 */
function createEvent(
  degree: ScaleDegree, 
  key: MusicalKey, 
  scale: ScaleType, 
  startTime: number, 
  duration: number,
  prevMidi: number | null,
  difficulty: MelodyDifficulty = "normal", 
  hasLeaped: boolean = false,
  constraints?: MelodyConstraints
): NoteEvent {
  // Pass the range limits into getNoteForDegree
  // For fretboard mode, these will be the fretboard-specific range
  // For other modes, these will be undefined and fall back to default vocal range
  const info = getNoteForDegree(
    key, 
    degree, 
    scale, 
    prevMidi, 
    difficulty, 
    hasLeaped,
    constraints?.minMidi,
    constraints?.maxMidi
  );
  
  return {
    noteInfo: info,
    startTime: startTime,
    duration: duration 
  };
}