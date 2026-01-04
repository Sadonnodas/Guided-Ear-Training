import type { TrainingLevel } from "../types";

export const MAJOR_LEVELS: TrainingLevel[] = [
  {
    id: 1,
    name: "Level 1: The Tonic Triad (1-3-5)",
    stages: [
      {
        // 0:00 - 2:00
        duration: 120, 
        label: "Warm Up: Root Centered",
        constraints: {
          allowedDegrees: ["1", "3", "5"],
          startDegree: "1",
          endDegree: "1",
          length: 3, 
        }
      },
      {
        // 2:00 - 4:00
        duration: 120, 
        label: "Practice: Start on Root",
        constraints: {
          allowedDegrees: ["1", "3", "5"],
          startDegree: "1",
          endDegree: undefined, // Can end on 3 or 5
          length: 4,
        }
      },
      {
        // 4:00 - 6:00
        duration: 120, 
        label: "Challenge: Free Triad",
        constraints: {
          allowedDegrees: ["1", "3", "5"],
          startDegree: undefined, // Start on any (1,3,5)
          endDegree: undefined,   // End on any (1,3,5)
          length: 4,
        }
      }
    ]
  }
];