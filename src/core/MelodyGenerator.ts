import { getNoteForDegree } from "../audio/MusicTheory";
import type { NoteEvent, MusicalKey, ScaleType, ScaleDegree, MelodyConstraints, MelodyDifficulty, RhythmStyle } from "../types";

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

// Minimum number of melodic leaps (a minor 3rd or larger) a melody should
// contain at each difficulty. Higher difficulties demand more leaps so "hard"
// reliably produces harder melodies, not just a higher interval ceiling.
const MIN_LEAPS: Record<MelodyDifficulty, number> = {
  easiest: 0,
  easy: 1,
  normal: 1,
  hard: 2,
};

const LEAP_SEMITONES = 3; // A minor 3rd or larger counts as a leap.

function countLeaps(melody: NoteEvent[]): number {
  let leaps = 0;
  for (let i = 1; i < melody.length; i++) {
    if (Math.abs(melody[i].noteInfo.midi - melody[i - 1].noteInfo.midi) >= LEAP_SEMITONES) {
      leaps++;
    }
  }
  return leaps;
}

/**
 * Generate a melody, retrying until it has enough leaps for the chosen
 * difficulty. Generation is cheap (4 notes), so a few attempts cost nothing;
 * if the range is too narrow to ever hit the target we keep the leapiest
 * attempt instead of looping forever.
 */
/**
 * Bar patterns, four beats each, built only from half, quarter and eighth
 * notes and their rests. A negative value is a rest of that length.
 *
 * Patterns rather than a free partition of the bar. Picking lengths freely
 * made rhythms that totalled correctly and were awkward to sing — three
 * beats then three then one is arithmetic, not a rhythm. These are shapes
 * that land on the beat.
 *
 * None of them opens with a rest: a melody that begins with silence reads as
 * the app having failed to start.
 */
const BAR_PATTERNS: Record<RhythmStyle, number[][]> = {
  steady: [[2, 2]],
  varied: [
    [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1],
    [2, 1, -1], [1, 1, -1, 1], [2, -1, 1], [1, 2, -1], [1, -1, 1, 1],
  ],
  complex: [
    [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1],
    [1, 0.5, 0.5, 2], [2, 0.5, 0.5, 1], [0.5, 0.5, 1, 2], [2, 1, 0.5, 0.5],
    [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 2], [1, 0.5, 0.5, 2],
    [2, 1, -1], [1, 0.5, 0.5, -1, 1], [0.5, 0.5, 1, -1, 1], [2, -1, 0.5, 0.5],
  ],
};

/** A melody is two bars, as it has always been. */
const BARS_PER_MELODY = 2;

interface RhythmSlot {
  beats: number;
  rest: boolean;
}

function buildRhythm(style: RhythmStyle): RhythmSlot[] {
  const patterns = BAR_PATTERNS[style] ?? BAR_PATTERNS.steady;
  const slots: RhythmSlot[] = [];
  for (let bar = 0; bar < BARS_PER_MELODY; bar++) {
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    pattern.forEach((value) => slots.push({ beats: Math.abs(value), rest: value < 0 }));
  }
  return slots;
}

/**
 * The degrees this melody is allowed to use — at most `size` of them.
 *
 * Rhythm adds note events, not new pitches to recognise: a bar of six notes
 * drawn from four degrees is a rhythm exercise, a bar of six different
 * degrees is a different and much harder exercise. Anything asked for by
 * name — the start, the end, the focused degrees — takes its place first.
 */
function buildDegreePool(
  size: number,
  playable: ScaleDegree[],
  required: (ScaleDegree | undefined)[],
): ScaleDegree[] {
  const pool: ScaleDegree[] = [];
  for (const degree of required) {
    if (degree && playable.includes(degree) && !pool.includes(degree) && pool.length < size) {
      pool.push(degree);
    }
  }
  const spare = playable.filter((d) => !pool.includes(d)).sort(() => Math.random() - 0.5);
  while (pool.length < size && spare.length) pool.push(spare.pop()!);
  return pool.length ? pool : ["1"];
}

export function generateMelody(options: GeneratorOptions): NoteEvent[] {
  const difficulty = options.constraints.difficulty || "normal";
  const minLeaps = MIN_LEAPS[difficulty] ?? 0;

  let best: NoteEvent[] = [];
  let bestLeaps = -1;

  for (let attempt = 0; attempt < 25; attempt++) {
    const melody = buildMelody(options);
    const leaps = countLeaps(melody);
    if (leaps >= minLeaps) return melody;
    if (leaps > bestLeaps) {
      bestLeaps = leaps;
      best = melody;
    }
  }
  return best;
}

function buildMelody(options: GeneratorOptions): NoteEvent[] {
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
  
  // 1. The rhythm first: it decides how many notes there are to fill.
  const slots = buildRhythm(constraints.rhythm || "steady");
  const sounding = slots.filter((slot) => !slot.rest).length;

  // 2. The degrees this melody may use. `length` is the number of DIFFERENT
  // degrees, not the number of notes — a busier rhythm repeats them rather
  // than introducing more to recognise.
  const pool = buildDegreePool(
    Math.max(1, Math.min(length, playableDegrees.length)),
    playableDegrees,
    [startDegree, endDegree, ...(focusedDegrees ?? [])],
  );

  // 3. Place the degrees that were asked for by name.
  const degrees: (ScaleDegree | null)[] = new Array(sounding).fill(null);
  if (startDegree && pool.includes(startDegree)) degrees[0] = startDegree;
  if (endDegree && pool.includes(endDegree)) degrees[sounding - 1] = endDegree;

  if (focusedDegrees && focusedDegrees.length > 0) {
      const focusPool = [...focusedDegrees].filter(d => pool.includes(d)).sort(() => Math.random() - 0.5);
      const emptyIndices = degrees
          .map((val, idx) => val === null ? idx : -1)
          .filter(idx => idx !== -1)
          .sort(() => Math.random() - 0.5);

      while (focusPool.length > 0 && emptyIndices.length > 0) {
          degrees[emptyIndices.pop()!] = focusPool.pop()!;
      }
  }

  // 4. Fill the rest from the pool, avoiding three of the same in a row.
  for (let i = 0; i < sounding; i++) {
      if (degrees[i] !== null) continue;
      let candidates = [...pool];
      if (i >= 2) {
          const prev1 = degrees[i - 1];
          const prev2 = degrees[i - 2];
          if (prev1 && prev2 && prev1 === prev2) {
              const thinned = candidates.filter(d => d !== prev1);
              if (thinned.length) candidates = thinned;
          }
      }
      degrees[i] = candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 5. Convert abstract degrees to playable NoteEvents. Rests advance the
  // clock without sounding, so the melody still fills its two bars.
  const melody: NoteEvent[] = [];
  let currentBeat = 0;
  let lastMidi: number | null = null;
  let hasLeaped = false; // Internal flag to track if we've already done a big leap
  let soundingIndex = 0;

  slots.forEach((slot) => {
      if (slot.rest) {
          currentBeat += slot.beats;
          return;
      }

      const safeDegree = degrees[soundingIndex] || "1";
      soundingIndex += 1;

      // Pass the difficulty and current leap status
      const event = createEvent(safeDegree, key, scaleType, currentBeat, slot.beats, lastMidi, constraints.difficulty || "normal", hasLeaped, constraints);

      // If this specific note created a leap > 7 semitones, trip the flag
      if (lastMidi !== null && Math.abs(event.noteInfo.midi - lastMidi) > 7) {
          hasLeaped = true;
      }

      melody.push(event);
      currentBeat += slot.beats;
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