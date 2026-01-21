import type { TrainingLevel, ScaleDegree } from "../types";

/**
 * REDESIGNED TRAINING CURRICULUM
 * 
 * Each level introduces ONE new degree and follows a 4-stage progression:
 * 
 * Stage 1: Introduction (60s)
 *   - Only root + new degree
 *   - Training wheels FORCED ON
 *   - Focus on new degree
 *   - Start/End on "1"
 * 
 * Stage 2: Early Practice (90s)
 *   - All previous + new degree
 *   - Training wheels FORCED ON
 *   - Focus on new degree
 *   - Start/End on "1"
 *   - Difficulty: easiest → easy
 * 
 * Stage 3: Integration (90s)
 *   - All degrees from this level
 *   - Training wheels optional
 *   - Focus on new degree
 *   - Alternating: Start on "1" OR End on "1"
 *   - Difficulty: easy → normal
 * 
 * Stage 4: Mastery (120s)
 *   - All degrees from this level
 *   - Training wheels optional
 *   - No focus
 *   - Full freedom (no start/end constraints)
 *   - Difficulty: normal
 *   - Modulation every 10 melodies
 */

interface LevelConfig {
  id: number;
  name: string;
  newDegree: ScaleDegree;
  previousDegrees: ScaleDegree[];
  allDegrees: ScaleDegree[];
}

function createLevel(config: LevelConfig): TrainingLevel {
  const { id, name, newDegree, previousDegrees, allDegrees } = config;
  
  return {
    id,
    name,
    newDegree, // Store this for UI display
    stages: [
      // STAGE 1: Introduction - Pure isolation
      { 
        duration: 60,
        label: "Introduction",
        forceTrainingWheels: true,
        focusedDegree: newDegree, // Single new degree to focus on
        introSequence: ["1", newDegree, "1", newDegree] as ScaleDegree[],
        constraints: { 
          allowedDegrees: ["1", newDegree],
          focusedDegrees: [newDegree],
          startDegree: "1",
          endDegree: "1",
          length: 4,
          difficulty: "easiest"
        }
      },
      
      // STAGE 2: Early Practice - New + familiar degrees
      { 
        duration: 90,
        label: "Early Practice",
        forceTrainingWheels: true,
        focusedDegree: newDegree,
        constraints: { 
          allowedDegrees: [...previousDegrees, newDegree],
          focusedDegrees: [newDegree],
          startDegree: "1",
          endDegree: "1",
          length: 4,
          difficulty: "easy" // Progresses from easiest to easy
        }
      },
      
      // STAGE 3: Integration - Alternating constraints
      { 
        duration: 90,
        label: "Integration",
        forceTrainingWheels: false,
        focusedDegree: newDegree,
        alternatingConstraints: true, // Special flag for alternating behavior
        constraints: { 
          allowedDegrees: allDegrees,
          focusedDegrees: [newDegree],
          // Start/End will alternate: handled in game loop
          length: 4,
          difficulty: "normal" // Progresses from easy to normal
        }
      },
      
      // STAGE 4: Mastery Challenge - Full freedom + modulation
      {
        duration: 120,
        label: "Mastery",
        forceTrainingWheels: false,
        questionsPerKey: 10, // Triggers key changes
        constraints: { 
          allowedDegrees: allDegrees,
          // No focus, no start/end constraints
          length: 4,
          difficulty: "normal"
        }
      }
    ]
  };
}

// --- MAJOR SCALE CURRICULUM ---
export const MAJOR_LEVELS: TrainingLevel[] = [
  createLevel({
    id: 1,
    name: "Level 1: Root & Fifth",
    newDegree: "5",
    previousDegrees: ["1"],
    allDegrees: ["1", "5"]
  }),
  
  createLevel({
    id: 2,
    name: "Level 2: Major Third",
    newDegree: "3",
    previousDegrees: ["1", "5"],
    allDegrees: ["1", "3", "5"]
  }),
  
  createLevel({
    id: 3,
    name: "Level 3: Major Second",
    newDegree: "2",
    previousDegrees: ["1", "3", "5"],
    allDegrees: ["1", "2", "3", "5"]
  }),
  
  createLevel({
    id: 4,
    name: "Level 4: Perfect Fourth",
    newDegree: "4",
    previousDegrees: ["1", "2", "3", "5"],
    allDegrees: ["1", "2", "3", "4", "5"]
  }),
  
  createLevel({
    id: 5,
    name: "Level 5: Major Sixth",
    newDegree: "6",
    previousDegrees: ["1", "2", "3", "4", "5"],
    allDegrees: ["1", "2", "3", "4", "5", "6"]
  }),
  
  createLevel({
    id: 6,
    name: "Level 6: Major Seventh",
    newDegree: "7",
    previousDegrees: ["1", "2", "3", "4", "5", "6"],
    allDegrees: ["1", "2", "3", "4", "5", "6", "7"]
  })
];

// --- MINOR SCALE CURRICULUM ---
export const MINOR_LEVELS: TrainingLevel[] = [
  createLevel({
    id: 1,
    name: "Level 1: Root & Fifth",
    newDegree: "5",
    previousDegrees: ["1"],
    allDegrees: ["1", "5"]
  }),
  
  createLevel({
    id: 2,
    name: "Level 2: Minor Third",
    newDegree: "b3",
    previousDegrees: ["1", "5"],
    allDegrees: ["1", "b3", "5"]
  }),
  
  createLevel({
    id: 3,
    name: "Level 3: Major Second",
    newDegree: "2",
    previousDegrees: ["1", "b3", "5"],
    allDegrees: ["1", "2", "b3", "5"]
  }),
  
  createLevel({
    id: 4,
    name: "Level 4: Perfect Fourth",
    newDegree: "4",
    previousDegrees: ["1", "2", "b3", "5"],
    allDegrees: ["1", "2", "b3", "4", "5"]
  }),
  
  createLevel({
    id: 5,
    name: "Level 5: Minor Sixth",
    newDegree: "b6",
    previousDegrees: ["1", "2", "b3", "4", "5"],
    allDegrees: ["1", "2", "b3", "4", "5", "b6"]
  }),
  
  createLevel({
    id: 6,
    name: "Level 6: Minor Seventh",
    newDegree: "b7",
    previousDegrees: ["1", "2", "b3", "4", "5", "b6"],
    allDegrees: ["1", "2", "b3", "4", "5", "b6", "b7"]
  })
];

// Chromatic not used in training mode
export const CHROMATIC_LEVELS: TrainingLevel[] = [];