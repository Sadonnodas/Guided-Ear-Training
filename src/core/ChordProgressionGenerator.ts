import type { MusicalKey, ScaleType, ScaleDegree } from "../types";

export interface ChordInfo {
  roman: string; // Roman numeral (I, ii, V7, etc.)
  degree: ScaleDegree; // Root degree
  quality: 'major' | 'minor' | 'diminished' | 'augmented';
  seventh?: boolean; // Include 7th?
  intervals: number[]; // Semitones from root [0, 4, 7] for major triad
  inversion?: number; // 0 = root position, 1 = 1st inversion, 2 = 2nd inversion
  pianoRoot?: number; // MIDI pitch of the chord root in vocal register, chosen with voice leading
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
  "2": { roman: "ii°", degree: "2", quality: 'diminished', intervals: [0, 3, 6] },
  "b3": { roman: "♭III", degree: "b3", quality: 'major', intervals: [0, 4, 7] },
  "4": { roman: "iv", degree: "4", quality: 'minor', intervals: [0, 3, 7] },
  "5": { roman: "v", degree: "5", quality: 'minor', intervals: [0, 3, 7] },
  "b6": { roman: "♭VI", degree: "b6", quality: 'major', intervals: [0, 4, 7] },
  "b7": { roman: "♭VII", degree: "b7", quality: 'major', intervals: [0, 4, 7] }
};

// Scale degree order used to compute diatonic 7ths
const MAJOR_SCALE_ORDER: ScaleDegree[] = ["1", "2", "3", "4", "5", "6", "7"];
const MINOR_SCALE_ORDER: ScaleDegree[] = ["1", "2", "b3", "4", "5", "b6", "b7"];

/**
 * Compute the diatonic 7th interval (semitones above the chord root) for a
 * chord built on the given scale degree. This produces theoretically correct
 * 7ths: IM7/IVM7 get a major 7th, V7 a dominant 7th, ii7/vi7 a minor 7th, etc.
 */
function getDiatonicSeventhInterval(degree: ScaleDegree, scaleOrder: ScaleDegree[]): number {
  const i = scaleOrder.indexOf(degree);
  if (i === -1) return 10; // Fallback: minor 7th
  const seventhDegree = scaleOrder[(i + 6) % scaleOrder.length];
  const rootSt = DEGREE_TO_SEMITONE[degree];
  const seventhSt = DEGREE_TO_SEMITONE[seventhDegree];
  return ((seventhSt - rootSt) % 12 + 12) % 12;
}

interface GeneratorOptions {
  key: MusicalKey;
  scaleType: ScaleType;
  startOnOne: boolean;
  endOnOne: boolean;
  includeSevenths: boolean;       // Add diatonic 7ths to every chord
  enabledInversions: number[];    // Allowed inversions (0 = root, 1 = 1st, 2 = 2nd)
  minMidi: number;
  maxMidi: number;
  enabledDegrees?: ScaleDegree[]; // Only use these degrees
  focusedDegrees?: ScaleDegree[]; // Always include these degrees
}

// Vocal samples exist only from G2 to G4. The chord root is always sung by
// the voice, so any pianoRoot we pick must fall within this range — even if
// somehow the caller passes a wider range than the samples support.
const VOCAL_SAMPLE_MIN = 43;
const VOCAL_SAMPLE_MAX = 67;

/**
 * Pick a piano-root MIDI pitch for each chord in the progression.
 * The first chord gets a random octave within the singable range so successive
 * progressions don't all sit on identical pitches; subsequent chords use voice
 * leading (pick the octave closest to the previous chord's root) so the line
 * the voice sings is smooth and the visualizer doesn't jump octaves.
 */
function assignPianoRoots(
  progression: ChordInfo[],
  key: MusicalKey,
  minMidi: number,
  maxMidi: number
): void {
  // Always intersect the user's singable range with the actual sample range
  // so the voice can never be asked to sing a root that has no sample.
  const effMin = Math.max(minMidi, VOCAL_SAMPLE_MIN);
  const effMax = Math.min(maxMidi, VOCAL_SAMPLE_MAX);

  let prev: number | null = null;
  progression.forEach((chord, idx) => {
    const baseRoot = ROOT_MIDI[key] + DEGREE_TO_SEMITONE[chord.degree];
    const candidates: number[] = [];
    for (let o = -48; o <= 48; o += 12) {
      const c = baseRoot + o;
      if (c >= effMin && c <= effMax) candidates.push(c);
    }
    if (candidates.length === 0) {
      // No octave of this root fits — clamp into the sample range so the
      // vocal sample still exists (it will just be the nearest singable note).
      chord.pianoRoot = Math.max(VOCAL_SAMPLE_MIN, Math.min(VOCAL_SAMPLE_MAX, baseRoot));
    } else if (idx === 0 || prev === null) {
      chord.pianoRoot = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      candidates.sort((a, b) => Math.abs(a - prev!) - Math.abs(b - prev!));
      chord.pianoRoot = candidates[0];
    }
    prev = chord.pianoRoot;
  });
}

/**
 * Generate a modulation progression: I - III - V - I
 */
export function generateModulationProgression(
  key: MusicalKey,
  scaleType: ScaleType,
  minMidi: number,
  maxMidi: number
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

  assignPianoRoots(chords, key, minMidi, maxMidi);
  return { chords, key };
}

/**
 * Generate a chord progression based on constraints
 */
export function generateChordProgression(options: GeneratorOptions): ChordProgression {
  const {
    key, scaleType, startOnOne, endOnOne, includeSevenths, enabledInversions,
    minMidi, maxMidi, enabledDegrees, focusedDegrees
  } = options;

  const chordSet = scaleType === 'Minor' ? MINOR_CHORDS : MAJOR_CHORDS;

  // Get all chord degrees for this scale. Which degrees are actually used
  // (including the diminished chord) is controlled entirely by enabledDegrees.
  let availableDegrees = Object.keys(chordSet).filter(d => chordSet[d as ScaleDegree] !== undefined) as ScaleDegree[];

  // Apply enabled degrees filter (if provided)
  if (enabledDegrees && enabledDegrees.length > 0) {
    availableDegrees = availableDegrees.filter(d => enabledDegrees.includes(d));
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
  
  // Ensure we have the tonic chord available (if startOnOne or endOnOne)
  const tonicDegree: ScaleDegree = "1";
  if ((startOnOne || endOnOne) && !availableDegrees.includes(tonicDegree)) {
    availableDegrees.push(tonicDegree);
  }
  
  const progression: ChordInfo[] = [];
  
  // Helper to get chord safely
  const getChord = (degree: ScaleDegree): ChordInfo => {
    const chord = chordSet[degree];
    if (!chord) throw new Error(`Chord not found for degree ${degree}`);
    return { ...chord };
  };
  
  // NEW: Track which focused degrees we've included
  const focusedIncluded = new Set<ScaleDegree>();
  
  // Set start chord
  if (startOnOne) {
    progression.push(getChord(tonicDegree));
    if (focusedDegrees?.includes(tonicDegree)) {
      focusedIncluded.add(tonicDegree);
    }
  } else {
    const randomDegree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
    progression.push(getChord(randomDegree));
    if (focusedDegrees?.includes(randomDegree)) {
      focusedIncluded.add(randomDegree);
    }
  }
  
  // Generate middle chords (2 chords)
  // NEW: Prioritize including focused degrees
  for (let i = 0; i < 2; i++) {
    let selectedDegree: ScaleDegree;
    
    // Check if we need to include a focused degree
    const remainingFocused = focusedDegrees?.filter((d: ScaleDegree) => 
      !focusedIncluded.has(d) && availableDegrees.includes(d)
    ) || [];
    
    if (remainingFocused.length > 0) {
      // Pick a focused degree we haven't included yet
      selectedDegree = remainingFocused[Math.floor(Math.random() * remainingFocused.length)];
      focusedIncluded.add(selectedDegree);
    } else {
      // Normal random selection
      let candidatePool = [...availableDegrees];
      if (progression.length > 0) {
        const lastDegree = progression[progression.length - 1].degree;
        candidatePool = candidatePool.filter(d => d !== lastDegree);
        if (candidatePool.length === 0) candidatePool = [...availableDegrees];
      }
      selectedDegree = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      if (focusedDegrees?.includes(selectedDegree)) {
        focusedIncluded.add(selectedDegree);
      }
    }
    
    progression.push(getChord(selectedDegree));
  }
  
  // Set end chord
  if (endOnOne) {
    progression.push(getChord(tonicDegree));
    if (focusedDegrees?.includes(tonicDegree)) {
      focusedIncluded.add(tonicDegree);
    }
  } else {
    // Avoid immediate repetition
    let candidatePool = [...availableDegrees];
    const lastDegree = progression[progression.length - 1].degree;
    candidatePool = candidatePool.filter(d => d !== lastDegree);
    if (candidatePool.length === 0) candidatePool = [...availableDegrees];
    
    const randomDegree = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    progression.push(getChord(randomDegree));
  }
  
  // Apply 7th chords when enabled — diatonic 7ths added to EVERY chord so the
  // progression is consistent (no random per-chord variation).
  if (includeSevenths) {
    const scaleOrder = scaleType === 'Minor' ? MINOR_SCALE_ORDER : MAJOR_SCALE_ORDER;
    progression.forEach((chord: ChordInfo) => {
      chord.seventh = true;
      const seventhInterval = getDiatonicSeventhInterval(chord.degree, scaleOrder);
      chord.intervals = [...chord.intervals, seventhInterval];
    });
  }

  // Assign each chord a voicing (inversion) picked from the enabled set.
  const inversions = (enabledInversions && enabledInversions.length > 0) ? enabledInversions : [0];
  progression.forEach((chord: ChordInfo) => {
    chord.inversion = inversions[Math.floor(Math.random() * inversions.length)];
  });

  // Pick the piano-root pitch for each chord with voice leading.
  assignPianoRoots(progression, key, minMidi, maxMidi);

  return { chords: progression, key };
}

/**
 * Calculate MIDI notes for a chord.
 * Returns:
 *   bass  - the inversion's bass note (root / 3rd / 5th), placed in the bass
 *           register — this is what makes an inversion an inversion
 *   root  - the chord root in vocal range, for the vocal sample + visualizer
 *           (unaffected by inversion or voicing)
 *   triad - the piano voicing (rootless for 7th chords — see below)
 */
export function getChordMidiNotes(
  chord: ChordInfo,
  key: MusicalKey,
  minMidi: number,
  maxMidi: number
): { bass: number; root: number; triad: number[] } {
  const rootMidi = ROOT_MIDI[key];
  const degreeInterval = DEGREE_TO_SEMITONE[chord.degree];
  const baseRoot = rootMidi + degreeInterval;

  // Honour the pianoRoot already chosen by the generator (voice-led, with a
  // randomised first chord). Fall back to a sensible mid-range pick if the
  // chord wasn't routed through the generator (e.g. ad-hoc test paths).
  let pianoRoot = chord.pianoRoot ?? baseRoot;
  if (chord.pianoRoot === undefined) {
    const candidates: number[] = [];
    for (let octaveOffset = -48; octaveOffset <= 48; octaveOffset += 12) {
      candidates.push(baseRoot + octaveOffset);
    }
    const validCandidates = candidates.filter(n => n >= minMidi && n <= maxMidi);
    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => {
        const midRange = (minMidi + maxMidi) / 2;
        return Math.abs(a - midRange) - Math.abs(b - midRange);
      });
      pianoRoot = validCandidates[0];
    } else {
      pianoRoot = Math.max(minMidi, Math.min(maxMidi, baseRoot));
    }
  }
  
  const root = pianoRoot;

  // Which chord tone is in the bass, decided by the inversion:
  //   0 = root position, 1 = 3rd in the bass, 2 = 5th in the bass.
  const inversion = chord.inversion ?? 0;
  const bassInterval = chord.intervals[Math.min(inversion, chord.intervals.length - 1)] ?? 0;

  // Piano voicing intervals (relative to the chord root):
  //  - 7th chords are voiced ROOTLESS: the piano plays every chord tone
  //    except the one the bass is covering. In root position that's the
  //    classic 3-5-7 voicing; in an inversion the piano supplies the root
  //    so the chord still sounds complete.
  //  - triads keep the full root-3rd-5th (the bass just doubles one tone).
  const pianoIntervals = chord.seventh
    ? chord.intervals.filter(iv => iv !== bassInterval)
    : [...chord.intervals];

  // Place the piano voicing in a register that fits the sample range AND
  // always leaves room for the bass note underneath it.
  const PIANO_MIN = 48;
  const PIANO_MAX = 67;
  let voiced = pianoIntervals.map(iv => root + iv);
  while (Math.max(...voiced) > PIANO_MAX) voiced = voiced.map(n => n - 12);
  while (Math.min(...voiced) < PIANO_MIN) voiced = voiced.map(n => n + 12);

  // Bass plays the inversion's bass note, kept clearly below the piano voicing.
  const pianoMin = Math.min(...voiced);
  let bassNote = root + bassInterval;
  while (bassNote > pianoMin - 5) bassNote -= 12;
  while (bassNote < 28) bassNote += 12;

  return { bass: bassNote, root, triad: voiced };
}