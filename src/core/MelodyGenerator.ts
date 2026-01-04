import { getNoteForDegree } from "../audio/MusicTheory";
import type { NoteEvent, MusicalKey, ScaleType, ScaleDegree, MelodyConstraints } from "../types";

interface GeneratorOptions {
  key: MusicalKey;
  scaleType: ScaleType;
  constraints: MelodyConstraints;
}

export function generateMelody(options: GeneratorOptions): NoteEvent[] {
  const { key, scaleType, constraints } = options;
  const { allowedDegrees, startDegree, endDegree, length } = constraints;
  
  const melody: NoteEvent[] = [];
  
  // Safety: If allowedDegrees is empty (user unchecked everything), fallback to Root
  const pool = allowedDegrees.length > 0 ? allowedDegrees : ["1"];

  let currentBeat = 0;
  let lastMidi: number | null = null;

  for (let i = 0; i < length; i++) {
    const duration = 2; // Half Notes
    let degree: ScaleDegree;

    // --- REPETITION GUARD ---
    // Prevent 3 consecutive identical notes
    let candidatePool = [...pool];
    
    if (i >= 2) {
        const prev1 = melody[i-1].noteInfo.degree;
        const prev2 = melody[i-2].noteInfo.degree;
        
        // If the last two notes were the same, remove that degree from the options
        if (prev1 === prev2) {
            candidatePool = candidatePool.filter(d => d !== prev1);
            // Safety: If the pool is empty (e.g., user only enabled "1"), we must allow repetition
            if (candidatePool.length === 0) candidatePool = [...pool];
        }
    }

    // 1. Determine Degree
    // Priority 1: Start Constraint
    if (i === 0 && startDegree && pool.includes(startDegree)) {
      degree = startDegree;
    } 
    // Priority 2: End Constraint
    else if (i === length - 1 && endDegree && pool.includes(endDegree)) {
      degree = endDegree;
    } 
    // Priority 3: Random Selection (using the filtered pool)
    else {
      degree = candidatePool[Math.floor(Math.random() * candidatePool.length)] as ScaleDegree;
    }

    // 2. Create Event
    const event = createEvent(degree, key, scaleType, currentBeat, duration, lastMidi);
    melody.push(event);
    
    currentBeat += duration;
    lastMidi = event.noteInfo.midi;
  }

  return melody;
}

function createEvent(
  degree: ScaleDegree, 
  key: MusicalKey, 
  scale: ScaleType, 
  startTime: number, 
  duration: number,
  prevMidi: number | null
): NoteEvent {
  const info = getNoteForDegree(key, degree, scale, prevMidi);
  return {
    noteInfo: info,
    startTime: startTime,
    duration: duration 
  };
}