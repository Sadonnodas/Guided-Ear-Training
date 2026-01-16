import type { MusicalKey, ScaleType, ScaleDegree } from '../types';

export type CagedShape = "C" | "A" | "G" | "E" | "D";

// --- TUNING & PHYSICS ---
const STRING_MIDI_BASES: Record<number, number> = {
    6: 40, // E2
    5: 45, // A2
    4: 50, // D3
    3: 55, // G3
    2: 59, // B3
    1: 64  // E4
};

const ROOT_FRET_OFFSETS: Record<MusicalKey, number> = { 
  "E":0, "F":1, "Fs":2, "G":3, "Gs":4, "A":5, "As":6, "B":7, 
  "C":8, "Cs":9, "D":10, "Ds":11 
};

// --- PENTATONIC FORMULAS (Inlined from your reference) ---
const PENTATONIC_SHAPES = {
    major: {
        E: [{s:6, f:0, degree:'1'}, {s:6, f:2, degree:'2'}, {s:5, f:-1, degree:'3'}, {s:5, f:2, degree:'5'}, {s:4, f:-1, degree:'6'}, {s:4, f:2, degree:'1'}, {s:3, f:-1, degree:'2'}, {s:3, f:1, degree:'3'}, {s:2, f:0, degree:'5'}, {s:2, f:2, degree:'6'}, {s:1, f:0, degree:'1'}, {s:1, f:2, degree:'2'}],
        G: [{s:6, f:-3, degree:'6'}, {s:6, f:0, degree:'1'}, {s:5, f:-3, degree:'2'}, {s:5, f:-1, degree:'3'}, {s:4, f:-3, degree:'5'}, {s:4, f:-1, degree:'6'}, {s:3, f:-3, degree:'1'}, {s:3, f:-1, degree:'2'}, {s:2, f:-3, degree:'3'}, {s:2, f:0, degree:'5'}, {s:1, f:-3, degree:'6'}, {s:1, f:0, degree:'1'}],
        A: [{s:6, f:0, degree:'5'}, {s:6, f:2, degree:'6'}, {s:5, f:0, degree:'1'}, {s:5, f:2, degree:'2'}, {s:4, f:-1, degree:'3'}, {s:4, f:2, degree:'5'}, {s:3, f:-1, degree:'6'}, {s:3, f:2, degree:'1'}, {s:2, f:0, degree:'2'}, {s:2, f:2, degree:'3'}, {s:1, f:0, degree:'5'}, {s:1, f:2, degree:'6'}],
        C: [{s:6, f:-3, degree:'3'}, {s:6, f:0, degree:'5'}, {s:5, f:-3, degree:'6'}, {s:5, f:0, degree:'1'}, {s:4, f:-3, degree:'2'}, {s:4, f:-1, degree:'3'}, {s:3, f:-3, degree:'5'}, {s:3, f:-1, degree:'6'}, {s:2, f:-2, degree:'1'}, {s:2, f:0, degree:'2'}, {s:1, f:-3, degree:'3'}, {s:1, f:0, degree:'5'}],
        D: [{s:6, f:0, degree:'2'}, {s:6, f:2, degree:'3'}, {s:5, f:0, degree:'5'}, {s:5, f:2, degree:'6'}, {s:4, f:0, degree:'1'}, {s:4, f:2, degree:'2'}, {s:3, f:-1, degree:'3'}, {s:3, f:2, degree:'5'}, {s:2, f:0, degree:'6'}, {s:2, f:3, degree:'1'}, {s:1, f:0, degree:'2'}, {s:1, f:2, degree:'3'}]
    },
    minor: {
        E: [{s:6, f:0, degree:'1'}, {s:6, f:3, degree:'b3'}, {s:5, f:0, degree:'4'}, {s:5, f:2, degree:'5'}, {s:4, f:0, degree:'b7'}, {s:4, f:2, degree:'1'}, {s:3, f:0, degree:'b3'}, {s:3, f:2, degree:'4'}, {s:2, f:0, degree:'5'}, {s:2, f:3, degree:'b7'}, {s:1, f:0, degree:'1'}, {s:1, f:3, degree:'b3'}],
        G: [{s:6, f:-2, degree:'b7'}, {s:6, f:0, degree:'1'}, {s:5, f:-2, degree:'b3'}, {s:5, f:0, degree:'4'}, {s:4, f:-3, degree:'5'}, {s:4, f:0, degree:'b7'}, {s:3, f:-3, degree:'1'}, {s:3, f:0, degree:'b3'}, {s:2, f:-2, degree:'4'}, {s:2, f:0, degree:'5'}, {s:1, f:-2, degree:'b7'}, {s:1, f:0, degree:'1'}],
        A: [{s:6, f:0, degree:'5'}, {s:6, f:3, degree:'b7'}, {s:5, f:0, degree:'1'}, {s:5, f:3, degree:'b3'}, {s:4, f:0, degree:'4'}, {s:4, f:2, degree:'5'}, {s:3, f:0, degree:'b7'}, {s:3, f:2, degree:'1'}, {s:2, f:1, degree:'b3'}, {s:2, f:3, degree:'4'}, {s:1, f:0, degree:'5'}, {s:1, f:3, degree:'b7'}],
        C: [{s:6, f:-2, degree:'4'}, {s:6, f:0, degree:'5'}, {s:5, f:-2, degree:'b7'}, {s:5, f:0, degree:'1'}, {s:4, f:-2, degree:'b3'}, {s:4, f:0, degree:'4'}, {s:3, f:-3, degree:'5'}, {s:3, f:0, degree:'b7'}, {s:2, f:-2, degree:'1'}, {s:2, f:1, degree:'b3'}, {s:1, f:-2, degree:'4'}, {s:1, f:0, degree:'5'}],
        D: [{s:6, f:1, degree:'b3'}, {s:6, f:3, degree:'4'}, {s:5, f:0, degree:'5'}, {s:5, f:3, degree:'b7'}, {s:4, f:0, degree:'1'}, {s:4, f:3, degree:'b3'}, {s:3, f:0, degree:'4'}, {s:3, f:2, degree:'5'}, {s:2, f:1, degree:'b7'}, {s:2, f:3, degree:'1'}, {s:1, f:1, degree:'b3'}, {s:1, f:3, degree:'4'}]
    }
};

export function getFretboardConfig(key: MusicalKey, scale: ScaleType, shape: CagedShape) {
    const keyOffset = ROOT_FRET_OFFSETS[key];
    
    let anchorFret = keyOffset;
    if (shape === "A" || shape === "C") anchorFret = (keyOffset - 5 + 12) % 12;
    if (shape === "D") anchorFret = (keyOffset - 10 + 12) % 12;

    if (anchorFret < 2) anchorFret += 12;

    const startFret = anchorFret - 3; 
    const endFret = anchorFret + 4;

    const notes: { string: number; fret: number; degree: ScaleDegree; midi: number }[] = [];
    
    const isMinor = scale === 'PentatonicMinor' || scale === 'Minor';
    const patternGroup = isMinor ? PENTATONIC_SHAPES.minor : PENTATONIC_SHAPES.major;
    const activePattern = patternGroup[shape as keyof typeof patternGroup];

    if (activePattern) {
        activePattern.forEach((n) => {
            const absoluteFret = anchorFret + n.f;
            const midi = STRING_MIDI_BASES[n.s as keyof typeof STRING_MIDI_BASES] + absoluteFret;
            notes.push({
                string: n.s,
                fret: absoluteFret,
                degree: n.degree as ScaleDegree,
                midi: midi
            });
        });
    }

    return { startFret, endFret, notes };
}