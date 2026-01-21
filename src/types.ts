export type MusicalKey = "C" | "Cs" | "D" | "Ds" | "E" | "F" | "Fs" | "G" | "Gs" | "A" | "As" | "B";
export type ScaleDegree = "1" | "b2" | "2" | "b3" | "3" | "4" | "#4" | "5" | "b6" | "6" | "b7" | "7";
export type ScaleType = "Major" | "Minor" | "PentatonicMajor" | "PentatonicMinor" | "Chromatic"; 
export type MelodyDifficulty = "easiest" | "easy" | "normal" | "hard";
export type CagedShape = "C" | "A" | "G" | "E" | "D";

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
  difficulty?: MelodyDifficulty;
  minMidi?: number;
  maxMidi?: number;
}

export interface TrainingStage {
  duration: number; 
  label: string;
  constraints: MelodyConstraints;
  questionsPerKey?: number; 
  introSequence?: ScaleDegree[]; 
  scalePreview?: ScaleDegree[];
  forceTrainingWheels?: boolean;
  focusedDegree?: ScaleDegree; // NEW: Single degree being introduced
  alternatingConstraints?: boolean; // NEW: Flag for Stage 3 alternating start/end
}

export interface TrainingLevel {
  id: number;
  name: string;
  stages: TrainingStage[];
  newDegree?: ScaleDegree; // NEW: The new degree introduced in this level
  unlocked?: boolean; // NEW: For level progression system
  timeSpent?: number; // NEW: Track time in level (seconds)
}

export interface AppSettings {
  bpm: number;
  key: MusicalKey;
  scale: ScaleType;
  octaveRange: number; 
  shape?: CagedShape;
}

export interface FretboardSettings {
  selectedShape: CagedShape;
  hideVisuals: boolean;
}