/**
 * VOCAL SAMPLE LATENCY OFFSETS
 * Adjusts when melody notes play relative to the beat (in seconds).
 * Negative values trigger the sample earlier to compensate for slow attacks.
 */
export const LATENCY_OFFSET: Record<string, number> = {
  "1":  -0.070, 
  "b2": -0.085, 
  "2":  -0.100, 
  "b3": -0.110, 
  "3":  -0.120, 
  "4":  -0.100, 
  "#4": -0.130, 
  "5":  -0.180, 
  "b6": -0.150, 
  "6":  -0.160, 
  "b7": -0.170, 
  "7":  -0.170, 
};

/**
 * DRUM MACHINE SAMPLE OFFSETS
 * Fine-tune the timing of individual percussive hits.
 * Negative values pull the hit forward to align the 'peak' with the metronome.
 */
export const DRUM_OFFSETS: Record<string, number> = {
  // Core Elements
  kick:         -0.020,
  kick_soft:    -0.020,
  snare:        -0.015,
  rimshot:      -0.010,
  
  // Hi-Hats & Cymbals
  hihat:        -0.005,
  hihat_open:   -0.005,
  hihat_foot:   -0.010,
  hihat_vinyl:  -0.008,
  ride:         -0.010,
  crash:        -0.005,
  cymbal:       -0.010,

  // Auxiliary Percussion
  shaker:       -0.025,
  tambourine:   -0.020,
  woodblock:    -0.010,
  clave:        -0.010,
  triangle:     -0.005,
  
  // Body & Tools
  clap:         -0.010,
  snap:         -0.010,
  stick:        -0.005,

  // Toms
  racktom:      -0.010,
  floortom:     -0.020,
  
  // Aliases for specific sample names found in folder
  kick_goat:    -0.020,
  hats_open:    -0.005,
  hats_foot:    -0.010,
  hats_vinyl_edge: -0.008
};

/**
 * STABLE DRUM PATTERNS
 * Defined by beat positions (0 = Beat 1, 1 = Beat 2, 2 = Beat 3, 3 = Beat 4).
 * Decimals represent subdivisions (0.5 = 8th note, 0.25 = 16th note).
 */
export const DRUM_PATTERNS = {
  // --- CLASSIC ---
  "Classic Groove": {
    kick:  [0, 2],           
    snare: [1, 3],           
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] 
  },

  // --- LOFI CHILL ---
  "Lofi Chill": { // The Original
    kick_soft: [0, 1.5, 2.25],       
    snap: [1, 3],
    hats_vinyl_edge: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    shaker: [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75] 
  },
  "Lofi Chill B": { // Laid back, spacious
    kick_soft: [0, 2.5], // Kick on 1 and the "and of 3"
    snap: [1, 3],
    hats_vinyl_edge: [0, 1, 2, 3], // Quarter notes only for space
    shaker: [0.5, 1.5, 2.5, 3.5]   // Offbeats
  },
  "Lofi Chill C": { // Busy, rolling kick
    kick_soft: [0, 0.75, 2, 2.75], 
    snap: [1, 3],
    hats_vinyl_edge: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.5] // Syncopated 16ths
  },

  // --- BOSSA VIBE ---
  "Bossa Vibe": { // The Original (Classic Clave)
    kick_soft: [0, 1.5, 2, 3.5],     
    rimshot: [0, 0.75, 1.5, 2.5, 3.25], 
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
  },
  "Bossa Vibe B": { // Reverse Clave feel
    kick_soft: [0, 1.5, 2, 3.5],
    rimshot: [0.5, 1.25, 2, 2.75, 3.5], // Different accents
    shaker: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] // Straighter shaker
  },
  "Bossa Vibe C": { // Sparse, "Samba-lite"
    kick_soft: [0, 1, 2, 3], // Four on floor (Surdo style)
    rimshot: [0.75, 2.25, 3.75], // Minimal syncopation
    shaker: [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75]
  },

  // --- PERCUSSION ONLY ---
  "Percussion Only": { // The Original (No Triangle)
    woodblock: [0, 1, 2, 3],
    tambourine: [0.5, 1.5, 2.5, 3.5],
    clave: [0.75, 2.25, 3.75],
    floortom: [3.5]
  },
  "Percussion Only B": { // Stick & Snap Groove
    stick: [0, 0.75, 1.5, 2.25, 3],
    snap: [1, 3],
    woodblock: [0.5, 2.5],
    shaker: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
  },
  "Percussion Only C": { // Driving Shaker
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
    clave: [0, 1.5, 2, 3.5], // Son Clave 3-2
    floortom: [0, 2] // Heavy accents
  }
};

/**
 * TRAINING WHEELS CONFIG
 * Configuration for the warm pitch-guide synth played during the silent pass.
 */
export const TRAINING_WHEELS_CONFIG = {
  oscillator: { 
    type: "triangle" as OscillatorType 
  },
  envelope: { 
    attack:  0.020, 
    decay:   0.100, 
    sustain: 0.300, 
    release: 1.000 
  },
  // CHANGED: Increased volume significantly (was -12)
  volume: -5 
};