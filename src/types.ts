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

export interface MelodyConstraints {
  allowedDegrees: ScaleDegree[];
  startDegree?: ScaleDegree;     
  endDegree?: ScaleDegree;       
  length: number;                
}

export interface TrainingStage {
  duration: number; // Duration in seconds (relative to standard time)
  label: string;
  constraints: MelodyConstraints;
  questionsPerKey?: number; // NEW: How often to change key (undefined = infinite/no change)
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