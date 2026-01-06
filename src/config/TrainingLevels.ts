import type { TrainingLevel } from "../types";

// Helper to create the 3-stage progression (Hidden from UI, but active in logic)
const createLevel = (id: number, name: string, degrees: string[], intro?: string[]) => {
  return {
    id,
    name,
    stages: [
      { 
        duration: 60, 
        label: "Guided", 
        forceTrainingWheels: true,
        scalePreview: degrees, 
        introSequence: intro,
        constraints: { allowedDegrees: degrees, startDegree: "1", endDegree: "1", length: 4 }
      },
      { 
        duration: 90, 
        label: "Practice", 
        forceTrainingWheels: false,
        constraints: { allowedDegrees: degrees, startDegree: "1", endDegree: "1", length: 4 }
      },
      { 
        duration: 90, 
        label: "Free Melody", 
        constraints: { allowedDegrees: degrees, length: 4 }
      }
    ]
  } as TrainingLevel;
};

// --- MAJOR CURRICULUM ---
export const MAJOR_LEVELS: TrainingLevel[] = [
  createLevel(1, "Level 1: 1-5", ["1", "5"], ["1", "5", "1", "5"]),
  createLevel(2, "Level 2: 1-3-5", ["1", "3", "5"], ["1", "3", "5", "1"]),
  createLevel(3, "Level 3: 1-2-3-5", ["1", "2", "3", "5"], ["1", "2", "3", "1"]),
  createLevel(4, "Level 4: 1-2-3-4-5", ["1", "2", "3", "4", "5"], ["1", "4", "3", "1"]),
  createLevel(5, "Level 5: 1-2-3-4-5-6", ["1", "2", "3", "4", "5", "6"], ["1", "5", "6", "5"]),
  createLevel(6, "Level 6: Full Scale", ["1", "2", "3", "4", "5", "6", "7"], ["1", "7", "1", "5"])
];

// --- MINOR CURRICULUM ---
export const MINOR_LEVELS: TrainingLevel[] = [
  createLevel(1, "Level 1: 1-5", ["1", "5"], ["1", "5", "1", "5"]),
  createLevel(2, "Level 2: 1-b3-5", ["1", "b3", "5"], ["1", "b3", "5", "1"]),
  createLevel(3, "Level 3: 1-2-b3-5", ["1", "2", "b3", "5"], ["1", "2", "b3", "1"]),
  createLevel(4, "Level 4: 1-2-b3-4-5", ["1", "2", "b3", "4", "5"], ["1", "4", "b3", "1"]),
  createLevel(5, "Level 5: 1-2-b3-4-5-b6", ["1", "2", "b3", "4", "5", "b6"], ["1", "5", "b6", "5"]),
  createLevel(6, "Level 6: Full Minor", ["1", "2", "b3", "4", "5", "b6", "b7"], ["1", "b7", "1", "5"])
];

export const CHROMATIC_LEVELS: TrainingLevel[] = [];