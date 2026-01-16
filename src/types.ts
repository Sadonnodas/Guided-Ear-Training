export type MusicalKey = "C" | "Cs" | "D" | "Ds" | "E" | "F" | "Fs" | "G" | "Gs" | "A" | "As" | "B";
export type ScaleDegree = "1" | "b2" | "2" | "b3" | "3" | "4" | "#4" | "5" | "b6" | "6" | "b7" | "7";
export type ScaleType = "Major" | "Minor" | "PentatonicMajor" | "PentatonicMinor" | "Chromatic"; 
export type MelodyDifficulty = "easy" | "normal" | "hard"; 
export type CagedShape = "C" | "A" | "G" | "E" | "D"; //

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
  focusedDegrees?: ScaleDegree[];
  startDegree?: ScaleDegree;
  endDegree?: ScaleDegree;
  length: number;
  difficulty?: MelodyDifficulty; // Add this line
}

export interface TrainingStage {
  duration: number; 
  label: string;
  constraints: MelodyConstraints;
  questionsPerKey?: number; 
  introSequence?: ScaleDegree[]; 
  scalePreview?: ScaleDegree[];
  
  // NEW: Pedagogical tools
  forceTrainingWheels?: boolean; // If true, pitch guide is forced ON
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
  shape?: CagedShape; // Added for the Fretboard Tab
}

export interface FretboardSettings {
  selectedShape: CagedShape;
  hideVisuals: boolean; // For the "Blind Mode" toggle you requested
}