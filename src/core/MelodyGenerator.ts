import { getNoteForDegree } from "../audio/MusicTheory";
import type { NoteEvent, MusicalKey, ScaleType, ScaleDegree, MelodyConstraints, MelodyDifficulty } from "../types";

interface GeneratorOptions {
  key: MusicalKey;
  scaleType: ScaleType;
  constraints: MelodyConstraints;
}

export function generateMelody(options: GeneratorOptions): NoteEvent[] {
  const { key, scaleType, constraints } = options;
  const { allowedDegrees, focusedDegrees, startDegree, endDegree, length } = constraints;
  
  // 1. Initialize empty slots
  const degrees: (ScaleDegree | null)[] = new Array(length).fill(null);
  
  // 2. Set Constraints (Start/End)
  // We only set them if they are actually in the allowed list (safety check)
  if (startDegree && allowedDegrees.includes(startDegree)) {
      degrees[0] = startDegree;
  }
  if (endDegree && allowedDegrees.includes(endDegree)) {
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
      while (focusPool.length > 0 && emptyIndices.length > 0) {
          const note = focusPool.pop()!;
          const idx = emptyIndices.pop()!;
          degrees[idx] = note;
      }
  }

  // 4. Fill remaining slots randomly from Allowed Degrees
  // Safety: If allowed is empty, default to "1" to prevent crashes.
  // FIX: Explicitly cast the default array to ScaleDegree[]
  const pool: ScaleDegree[] = allowedDegrees.length > 0 ? allowedDegrees : ["1"];
  
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
      const event = createEvent(
          safeDegree, 
          key, 
          scaleType, 
          currentBeat, 
          noteDur, 
          lastMidi, 
          constraints.difficulty || "normal", 
          hasLeaped
      );

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
export function generateFixedPattern(pattern: ScaleDegree[], key: MusicalKey, scaleType: ScaleType): NoteEvent[] {
    const melody: NoteEvent[] = [];
    let currentBeat = 0;
    let lastMidi: number | null = null;
    
    pattern.forEach(degree => {
        const duration = 2; 
        const event = createEvent(degree, key, scaleType, currentBeat, duration, lastMidi);
        melody.push(event);
        currentBeat += duration;
        lastMidi = event.noteInfo.midi;
    });

    return melody;
}

/**
 * Helper to create the NoteEvent object with correct MIDI pitch
 */
function createEvent(
  degree: ScaleDegree, 
  key: MusicalKey, 
  scale: ScaleType, 
  startTime: number, 
  duration: number,
  prevMidi: number | null,
  difficulty: MelodyDifficulty = "normal", // Add
  hasLeaped: boolean = false                // Add
): NoteEvent {
  // Pass the new difficulty and hasLeaped flags
  const info = getNoteForDegree(key, degree, scale, prevMidi, difficulty, hasLeaped);
  return {
    noteInfo: info,
    startTime: startTime,
    duration: duration 
  };
}