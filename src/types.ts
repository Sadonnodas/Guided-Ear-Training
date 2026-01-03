export type MusicalKey = "C" | "Cs" | "D" | "Ds" | "E" | "F" | "Fs" | "G" | "Gs" | "A" | "As" | "B";
export type ScaleDegree = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type ScaleType = "Major" | "Minor" | "PentatonicMajor" | "PentatonicMinor";

export interface NoteInfo {
  degree: ScaleDegree;
  midi: number;
  frequency: number;
  label: string; // e.g., "C4"
}

export interface NoteEvent {
  noteInfo: NoteInfo;
  startTime: number; // In beats (0, 1, 2...)
  duration: number;  // In beats (1 = quarter note)
}

export interface AppSettings {
  bpm: number;
  key: MusicalKey;
  scale: ScaleType;
  octaveRange: number; // 1 or 2
}