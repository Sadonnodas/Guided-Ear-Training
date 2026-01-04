export type MusicalKey = "C" | "Cs" | "D" | "Ds" | "E" | "F" | "Fs" | "G" | "Gs" | "A" | "As" | "B";
export type ScaleDegree = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type ScaleType = "Major" | "Minor" | "PentatonicMajor" | "PentatonicMinor";

export interface NoteInfo {
  degree: ScaleDegree;
  midi: number;
  frequency: number;
  label: string; 
}

export interface NoteEvent {
  noteInfo: NoteInfo;
  startTime: number; 
  duration: number;  
}

// --- NEW TYPES FOR TRAINING ---

export interface MelodyConstraints {
  allowedDegrees: ScaleDegree[]; // e.g., ["1", "3", "5"]
  startDegree?: ScaleDegree;     // If undefined, can start on any allowed
  endDegree?: ScaleDegree;       // If undefined, can end on any allowed
  length: number;                // Number of notes
}

export interface TrainingStage {
  duration: number; // Seconds to spend in this stage
  label: string;    // Description for the UI (e.g. "Warm Up")
  constraints: MelodyConstraints;
}

export interface TrainingLevel {
  id: number;
  name: string;
  stages: TrainingStage[];
}

export interface AppSettings {
  bpm: number;
  key: MusicalKey;
  scale: ScaleType;
  octaveRange: number; 
}