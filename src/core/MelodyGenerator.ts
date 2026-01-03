// Updated path: pointing to ../audio/MusicTheory instead of ./MusicTheory
import { getNoteForDegree } from "../audio/MusicTheory";
import type { NoteEvent, MusicalKey, ScaleType, ScaleDegree } from "../types";

interface GeneratorOptions {
  length: number;
  key: MusicalKey;
  scaleType: ScaleType;
  startOnRoot: boolean;
  endOnRoot: boolean;
  activeDegrees: ScaleDegree[];
}

export function generateMelody(options: GeneratorOptions): NoteEvent[] {
  const { length, key, scaleType, startOnRoot, endOnRoot, activeDegrees } = options;
  
  const melody: NoteEvent[] = [];
  
  // Safety: If no degrees active, fallback to Root
  const pool = activeDegrees.length > 0 ? activeDegrees : ["1"];

  // 1. First Note
  let currentDegree: ScaleDegree;
  if (startOnRoot && pool.includes("1")) {
    currentDegree = "1";
  } else {
    currentDegree = pool[Math.floor(Math.random() * pool.length)] as ScaleDegree;
  }

  let currentBeat = 0;
  let lastMidi: number | null = null;

  for (let i = 0; i < length; i++) {
    const duration = 2; // Half Notes

    // --- ENDING LOGIC ---
    if (endOnRoot && i === length - 1 && pool.includes("1")) {
        currentDegree = "1";
    }

    // Create Event
    const event = createEvent(currentDegree, key, scaleType, currentBeat, duration, lastMidi);
    melody.push(event);
    
    currentBeat += duration;
    lastMidi = event.noteInfo.midi; // Update history for voice leading

    // --- NEXT NOTE LOGIC ---
    if (i < length - 1) {
        // Pick next degree from POOL
        const nextDegree = pool[Math.floor(Math.random() * pool.length)] as ScaleDegree;
        currentDegree = nextDegree;
    }
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