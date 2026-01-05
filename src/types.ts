export type MusicalKey = "C" | "Cs" | "D" | "Ds" | "E" | "F" | "Fs" | "G" | "Gs" | "A" | "As" | "B";

// ADD ALL CHROMATIC DEGREES HERE
export type ScaleDegree = "1" | "b2" | "2" | "b3" | "3" | "4" | "#4" | "5" | "b6" | "6" | "b7" | "7";

// Ensure Chromatic is an option if you plan to use it later
export type ScaleType = "Major" | "Minor" | "PentatonicMajor" | "PentatonicMinor" | "Chromatic";

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

export interface MelodyConstraints {
  allowedDegrees: ScaleDegree[];
  startDegree?: ScaleDegree;     
  endDegree?: ScaleDegree;       
  length: number;                
}

export interface TrainingStage {
  duration: number; 
  label: string;
  constraints: MelodyConstraints;
  questionsPerKey?: number; 
  introSequence?: ScaleDegree[]; // The 1-6-6-1 pattern
  scalePreview?: ScaleDegree[];  // NEW: The linear 1-2-3-4-5 pattern
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