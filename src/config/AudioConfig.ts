import * as Tone from "tone";

/**
 * VOCAL SAMPLE LATENCY OFFSETS
 */
export const LATENCY_OFFSET: Record<string, number> = {
  "1":  -0.070, 
  "b2": -0.085, // New
  "2":  -0.100, 
  "b3": -0.200, // New
  "3":  -0.120, 
  "4":  -0.100, 
  "#4": -0.130, // New
  "5":  -0.180, 
  "b6": -0.200, // New
  "6":  -0.160, 
  "b7": -0.200, // New
  "7":  -0.170, 
};

/**
 * DRUM MACHINE SAMPLE OFFSETS
 */
export const DRUM_OFFSETS: Record<string, number> = {
  kick:         -0.020,
  kick_soft:    -0.020,
  snare:        -0.015,
  rimshot:      -0.010,
  hihat:        -0.005,
  hihat_open:   -0.005,
  hihat_foot:   -0.010,
  hihat_vinyl:  -0.008,
  ride:         -0.010,
  crash:        -0.005,
  cymbal:       -0.010,
  shaker:       -0.025,
  tambourine:   -0.020,
  woodblock:    -0.010,
  clave:        -0.010,
  triangle:     -0.005,
  clap:         -0.010,
  snap:         -0.010,
  stick:        -0.005,
  racktom:      -0.010,
  floortom:     -0.020,
  kick_goat:    -0.020,
  hats_open:    -0.005,
  hats_foot:    -0.010,
  hats_vinyl_edge: -0.008
};

/**
 * STABLE DRUM PATTERNS
 * Defined by beat positions (0 = Beat 1, 1 = Beat 2, 2 = Beat 3, 3 = Beat 4).
 */
export const DRUM_PATTERNS = {
  // --- CLASSIC (Standard Kit) ---
  "Classic Groove": {
    kick:  [0, 2],           
    snare: [1, 3],           
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] // Straight 8ths
  },
  "Classic Groove B": { // Driving Pop
    kick:  [0, 1.5, 2, 2.5], 
    snare: [1, 3],
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
  },
  "Classic Groove C": { // Syncopated Funk/Rock
    kick:  [0, 0.75, 1.5, 2.5], // 1, (1)e&a, (2)&, (3)&
    snare: [1, 3],              // 2, 4
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] // Straight 8ths
  },

  // --- LOFI CHILL ---
  "Lofi Chill": { 
    kick_soft: [0, 1.5, 2.25],       
    snap: [1, 3],
    hats_vinyl_edge: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    shaker: [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75] 
  },
  "Lofi Chill B": { // Spacious
    kick_soft: [0, 2.5], 
    snap: [1, 3],
    hats_vinyl_edge: [0, 1, 2, 3], 
    shaker: [0.5, 1.5, 2.5, 3.5]   
  },
  "Lofi Chill C": { // Busy/Syncopated
    kick_soft: [0, 0.75, 2, 2.75], 
    snap: [1, 3],
    hats_vinyl_edge: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.5] 
  },

  // --- BOSSA VIBE ---
  "Bossa Vibe": { 
    kick_soft: [0, 1.5, 2, 3.5],     
    rimshot: [0, 0.75, 1.5, 2.5, 3.25], 
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
  },
  "Bossa Vibe B": { // Reverse Clave accent
    kick_soft: [0, 1.5, 2, 3.5],
    rimshot: [0.5, 1.25, 2, 2.75, 3.5], 
    shaker: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] 
  },
  "Bossa Vibe C": { // Simple Clave & Shaker
    kick_soft: [0, 2], // Simple pulse on 1 and 3
    clave: [0, 0.75, 1.5], // The "3-side" of a Son Clave pattern
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
  },

  // --- PERCUSSION ONLY ---
  "Percussion Only": { 
    woodblock: [0, 1, 2, 3],
    tambourine: [0.5, 1.5, 2.5, 3.5],
    clave: [0.75, 2.25, 3.75],
    racktom: [3, 3.25], // NEW: Little fill leading into the floor tom
    kick_soft: [1, 2, 3, 4], 
    floortom: [3.5]
  },
  "Percussion Only B": { 
    stick: [0, 0.75, 1.5, 2.25, 3],
    snap: [1, 3],
    woodblock: [0.5, 2.5],
    shaker: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
  },
  "Percussion Only C": { 
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
    clave: [0, 1.5, 2, 3.5], 
    floortom: [0, 2],
    kick_soft: [1, 3],
    racktom: [3.75]
  }
};

export const TRAINING_WHEELS_CONFIG = {
  oscillator: { 
    type: "triangle" as Tone.ToneOscillatorType 
  },
  envelope: { 
    attack:  0.020, 
    decay:   0.100, 
    sustain: 0.300, 
    release: 1.000 
  },
  volume: -5 
};