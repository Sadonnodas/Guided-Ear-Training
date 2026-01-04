import type { TrainingLevel } from "../types";

export const MAJOR_LEVELS: TrainingLevel[] = [
  // --- LEVEL 1: The Tonic Triad (Stability) ---
  {
    id: 1,
    name: "Lvl 1: The Tonic Triad (1-3-5)",
    stages: [
      { duration: 60, label: "Warm Up: Root Centered", constraints: { allowedDegrees: ["1", "3", "5"], startDegree: "1", endDegree: "1", length: 3 } },
      { duration: 120, label: "Practice: Starting on Root", constraints: { allowedDegrees: ["1", "3", "5"], startDegree: "1", length: 4 } },
      { duration: 120, label: "Challenge: Free Triad", constraints: { allowedDegrees: ["1", "3", "5"], length: 4 } }
    ]
  },
  // --- LEVEL 2: Stepwise Motion (1-2-3) ---
  {
    id: 2,
    name: "Lvl 2: First Steps (1-2-3)",
    stages: [
      { duration: 60, label: "Ear Calibration (1-2)", constraints: { allowedDegrees: ["1", "2"], startDegree: "1", length: 3 } },
      { duration: 120, label: "Do-Re-Mi Patterns", constraints: { allowedDegrees: ["1", "2", "3"], startDegree: "1", endDegree: "1", length: 4 } },
      { duration: 120, label: "Free Movement (1-2-3)", constraints: { allowedDegrees: ["1", "2", "3"], length: 5 } }
    ]
  },
  // --- LEVEL 3: Major Pentatonic Foundation (No Semitones) ---
  {
    id: 3,
    name: "Lvl 3: Pentatonic (1-2-3-5-6)",
    stages: [
      { duration: 90, label: "Low Pentatonic (1-2-3-5)", constraints: { allowedDegrees: ["1", "2", "3", "5"], startDegree: "1", length: 4 } },
      { duration: 120, label: "Full Pentatonic (Start Root)", constraints: { allowedDegrees: ["1", "2", "3", "5", "6"], startDegree: "1", endDegree: "1", length: 4 } },
      { duration: 90, label: "Pentatonic Freedom", constraints: { allowedDegrees: ["1", "2", "3", "5", "6"], length: 5 } }
    ]
  },
  // --- LEVEL 4: The Subdominant (The 4) ---
  {
    id: 4,
    name: "Lvl 4: The Subdominant (add 4)",
    stages: [
      { duration: 60, label: "1-3-4-3 Resolution", constraints: { allowedDegrees: ["1", "3", "4"], startDegree: "1", endDegree: "3", length: 4 } },
      { duration: 120, label: "Pentatonic + 4", constraints: { allowedDegrees: ["1", "2", "3", "4", "5"], length: 5 } },
      { duration: 120, label: "Avoiding the 7", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6"], length: 5 } }
    ]
  },
  // --- LEVEL 5: The Leading Tone (The 7) ---
  {
    id: 5,
    name: "Lvl 5: The Leading Tone (add 7)",
    stages: [
      { duration: 90, label: "7 resolving to 1", constraints: { allowedDegrees: ["1", "7", "2"], startDegree: "1", endDegree: "1", length: 4 } },
      { duration: 120, label: "Upper Tetrachord (5-6-7-1)", constraints: { allowedDegrees: ["5", "6", "7", "1"], length: 4 } },
      { duration: 90, label: "Full Scale (Root Start)", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], startDegree: "1", length: 5 } }
    ]
  },
  // --- LEVEL 6: Full Major Scale (Stepwise) ---
  {
    id: 6,
    name: "Lvl 6: Full Major Scale",
    stages: [
      { duration: 120, label: "Root to 5", constraints: { allowedDegrees: ["1", "2", "3", "4", "5"], length: 5 } },
      { duration: 120, label: "5 to Octave", constraints: { allowedDegrees: ["5", "6", "7", "1"], length: 5 } },
      { duration: 120, label: "Full Range Stepwise", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], length: 6 } }
    ]
  },
  // --- LEVEL 7: Intervals - Thirds ---
  {
    id: 7,
    name: "Lvl 7: Intervals (3rds)",
    stages: [
      { duration: 90, label: "1-3 and 2-4 pairs", constraints: { allowedDegrees: ["1", "2", "3", "4"], length: 4 } },
      { duration: 120, label: "Triadic Shapes (1-3-5, 2-4-6)", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6"], length: 5 } },
      { duration: 90, label: "Full Scale Skips", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], length: 6 } }
    ]
  },
  // --- LEVEL 8: Resolution & Cadence ---
  {
    id: 8,
    name: "Lvl 8: Resolution Mastery",
    stages: [
      { duration: 100, label: "Ending on 1 (Strict)", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], endDegree: "1", length: 5 } },
      { duration: 100, label: "Ending on 3 or 5", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], endDegree: "3", length: 5 } },
      { duration: 100, label: "Deceptive Endings (on 6)", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], endDegree: "6", length: 5 } }
    ]
  },
  // --- LEVEL 9: Modulation Intro ---
  {
    id: 9,
    name: "Lvl 9: Modulation Intro",
    stages: [
      { duration: 120, label: "Static Key Warmup", constraints: { allowedDegrees: ["1", "4", "5"], length: 4 }, questionsPerKey: Infinity },
      { duration: 120, label: "Modulation (Slow)", constraints: { allowedDegrees: ["1", "3", "5", "1"], length: 5 }, questionsPerKey: 10 },
      { duration: 120, label: "Full Scale + Modulation", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], length: 6 }, questionsPerKey: 10 }
    ]
  },
  // --- LEVEL 10: Mastery ---
  {
    id: 10,
    name: "Lvl 10: Major Scale Mastery",
    stages: [
      { duration: 60, label: "Speed Warmup", constraints: { allowedDegrees: ["1", "2", "3", "4", "5"], length: 6 }, questionsPerKey: 10 },
      { duration: 120, label: "Rapid Modulation", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], length: 7 }, questionsPerKey: 5 },
      { duration: 180, label: "The Final Exam", constraints: { allowedDegrees: ["1", "2", "3", "4", "5", "6", "7"], startDegree: undefined, endDegree: undefined, length: 8 }, questionsPerKey: 3 }
    ]
  }
];