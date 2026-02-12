import type { MusicalKey, ScaleType, ScaleDegree, MelodyDifficulty } from "../types";

export interface ChordInfo {
  roman: string; // Roman numeral (I, ii, V7, etc.)
  degree: ScaleDegree; // Root degree
  quality: 'major' | 'minor' | 'diminished' | 'augmented';
  seventh?: boolean; // Include 7th?
  intervals: number[]; // Semitones from root [0, 4, 7] for major triad
}

export interface ChordProgression {
  chords: ChordInfo[];
  key: MusicalKey;
}

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

// Define available chords in Major and Minor keys
const MAJOR_CHORDS: Partial<Record<ScaleDegree, ChordInfo>> = {
  "1": { roman: "I", degree: "1", quality: 'major', intervals: [0, 4, 7] },
  "2": { roman: "ii", degree: "2", quality: 'minor', intervals: [0, 3, 7] },
  "3": { roman: "iii", degree: "3", quality: 'minor', intervals: [0, 3, 7] },
  "4": { roman: "IV", degree: "4", quality: 'major', intervals: [0, 4, 7] },
  "5": { roman: "V", degree: "5", quality: 'major', intervals: [0, 4, 7] },
  "6": { roman: "vi", degree: "6", quality: 'minor', intervals: [0, 3, 7] },
  "7": { roman: "viiº", degree: "7", quality: 'diminished', intervals: [0, 3, 6] }
};

const MINOR_CHORDS: Partial<Record<ScaleDegree, ChordInfo>> = {
  "1": { roman: "i", degree: "1", quality: 'minor', intervals: [0, 3, 7] },
  "2": { roman: "iiº", degree: "2", quality: 'diminished', intervals: [0, 3, 6] },
  "b3": { roman: "III", degree: "b3", quality: 'major', intervals: [0, 4, 7] },
  "4": { roman: "iv", degree: "4", quality: 'minor', intervals: [0, 3, 7] },
  "5": { roman: "v", degree: "5", quality: 'minor', intervals: [0, 3, 7] },
  "b6": { roman: "VI", degree: "b6", quality: 'major', intervals: [0, 4, 7] },
  "b7": { roman: "VII", degree: "b7", quality: 'major', intervals: [0, 4, 7] }
};

// 7th chord intervals
const SEVENTH_INTERVALS: Record<string, number> = {
  'major': 11,      // Major 7th
  'minor': 10,      // Minor 7th (dominant 7th for major chords)
  'diminished': 9,  // Diminished 7th
};

interface GeneratorOptions {
  key: MusicalKey;
  scaleType: ScaleType;
  difficulty: MelodyDifficulty;
  startOnOne: boolean;
  endOnOne: boolean;
  includeDiminished: boolean;
  minMidi: number;
  maxMidi: number;
}

/**
 * Generate a modulation progression: I - III - V - I
 */
export function generateModulationProgression(
  key: MusicalKey,
  scaleType: ScaleType
): ChordProgression {
  const chordSet = scaleType === 'Minor' ? MINOR_CHORDS : MAJOR_CHORDS;
  
  // Helper to get chord safely
  const getChord = (degree: ScaleDegree): ChordInfo => {
    const chord = chordSet[degree];
    if (!chord) throw new Error(`Chord not found for degree ${degree}`);
    return { ...chord };
  };
  
  const chords: ChordInfo[] = [
    getChord("1"),
    getChord(scaleType === 'Minor' ? "b3" : "3"),
    getChord("5"),
    getChord("1")
  ];

  return { chords, key };
}

/**
 * Generate a chord progression based on constraints
 */
export function generateChordProgression(options: GeneratorOptions): ChordProgression {
  const { key, scaleType, difficulty, startOnOne, endOnOne, includeDiminished, minMidi, maxMidi } = options;
  
  const chordSet = scaleType === 'Minor' ? MINOR_CHORDS : MAJOR_CHORDS;
  
  // Get available chord degrees (filter out diminished if not included)
  let availableDegrees = Object.keys(chordSet).filter(d => chordSet[d as ScaleDegree] !== undefined) as ScaleDegree[];
  if (!includeDiminished) {
    availableDegrees = availableDegrees.filter(d => {
      const chord = chordSet[d];
      return chord && chord.quality !== 'diminished';
    });
  }
  
  // Filter by vocal range - check if root note can be sung
  availableDegrees = availableDegrees.filter(degree => {
    const rootMidi = ROOT_MIDI[key];
    const interval = DEGREE_TO_SEMITONE[degree];
    const basePitch = rootMidi + interval;
    
    // Check if any octave of this root fits in range
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      const candidate = basePitch + octaveOffset;
      if (candidate >= minMidi && candidate <= maxMidi) {
        return true;
      }
    }
    return false;
  });
  
  // Ensure we have the tonic chord available
  const tonicDegree: ScaleDegree = "1";
  if (!availableDegrees.includes(tonicDegree)) {
    availableDegrees.push(tonicDegree);
  }
  
  const progression: ChordInfo[] = [];
  
  // Helper to get chord safely
  const getChord = (degree: ScaleDegree): ChordInfo => {
    const chord = chordSet[degree];
    if (!chord) throw new Error(`Chord not found for degree ${degree}`);
    return { ...chord };
  };
  
  // Set start chord
  if (startOnOne) {
    progression.push(getChord(tonicDegree));
  } else {
    const randomDegree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
    progression.push(getChord(randomDegree));
  }
  
  // Generate middle chords (2 chords)
  for (let i = 0; i < 2; i++) {
    // Avoid immediate repetition
    let candidatePool = [...availableDegrees];
    if (progression.length > 0) {
      const lastDegree = progression[progression.length - 1].degree;
      candidatePool = candidatePool.filter(d => d !== lastDegree);
      if (candidatePool.length === 0) candidatePool = [...availableDegrees];
    }
    
    const randomDegree = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    progression.push(getChord(randomDegree));
  }
  
  // Set end chord
  if (endOnOne) {
    progression.push(getChord(tonicDegree));
  } else {
    // Avoid immediate repetition
    let candidatePool = [...availableDegrees];
    const lastDegree = progression[progression.length - 1].degree;
    candidatePool = candidatePool.filter(d => d !== lastDegree);
    if (candidatePool.length === 0) candidatePool = [...availableDegrees];
    
    const randomDegree = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    progression.push(getChord(randomDegree));
  }
  
  // Apply 7th chords based on difficulty
  if (difficulty === 'hard') {
    progression.forEach(chord => {
      // Add 7ths to some chords (50% chance for variety)
      if (Math.random() > 0.5 && chord.quality !== 'diminished') {
        chord.seventh = true;
        chord.roman = chord.roman + '7';
        const seventhInterval = chord.quality === 'major' 
          ? SEVENTH_INTERVALS['minor'] // Dominant 7th for major chords (V7)
          : SEVENTH_INTERVALS['minor']; // Minor 7th for minor chords
        chord.intervals = [...chord.intervals, seventhInterval];
      }
    });
  }
  
  return { chords: progression, key };
}

/**
 * Calculate MIDI notes for a chord, respecting vocal range for piano root
 * Returns { bass: number (one octave below piano root), triad: number[] }
 */
export function getChordMidiNotes(
  chord: ChordInfo,
  key: MusicalKey,
  minMidi: number,
  maxMidi: number
): { bass: number; triad: number[] } {
  const rootMidi = ROOT_MIDI[key];
  const degreeInterval = DEGREE_TO_SEMITONE[chord.degree];
  const baseRoot = rootMidi + degreeInterval;
  
  // Find best octave for piano root note within vocal range
  let pianoRoot = baseRoot;
  const candidates: number[] = [];
  for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
    candidates.push(baseRoot + octaveOffset);
  }
  
  // Filter to vocal range
  const validCandidates = candidates.filter(n => n >= minMidi && n <= maxMidi);
  
  if (validCandidates.length > 0) {
    // Choose middle of range
    validCandidates.sort((a, b) => {
      const midRange = (minMidi + maxMidi) / 2;
      return Math.abs(a - midRange) - Math.abs(b - midRange);
    });
    pianoRoot = validCandidates[0];
  } else {
    // Fallback: clamp to range
    pianoRoot = Math.max(minMidi, Math.min(maxMidi, baseRoot));
  }
  
  // Bass is one octave below piano root
  const bassNote = pianoRoot - 12;
  
  // Build triad from piano root
  const triad = chord.intervals.map(interval => pianoRoot + interval);
  
  return { bass: bassNote, triad };
}