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
 */
export const DRUM_PATTERNS = {
  "Standard Groove": {
    kick:  [0, 2],           // Beats 1 and 3
    snare: [1, 3],           // Beats 2 and 4
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] // Straight 8th notes
  },
  "Steady Pulse": {
    kick:  [0, 1, 2, 3],     // Four on the floor
    hihat: [0.5, 1.5, 2.5, 3.5] // Off-beat hats
  },
  "Acoustic Training": {
    kick_soft: [0, 2],
    stick: [1, 3],
    hihat_foot: [0, 1, 2, 3]
  },
  "Minimalist": {
    kick_soft: [0],
    triangle:  [1, 2, 3]
  },
  
  // --- NEW PATTERNS BASED ON SAMPLES ---
  "Disco Fever": {
    kick_goat: [0, 1, 2, 3],
    snare: [1, 3],
    hats_open: [0.5, 1.5, 2.5, 3.5], // Offbeats
    hats_foot: [0, 1, 2, 3]          // Pedal on beats
  },
  "Lofi Chill": {
    kick_soft: [0, 1.5, 2.25],       // Syncopated kick
    snap: [1, 3],
    hats_vinyl_edge: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    shaker: [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75] // 16th note texture
  },
  "Bossa Vibe": {
    kick_soft: [0, 1.5, 2, 3.5],     // Classic dotted pattern
    rimshot: [0, 0.75, 1.5, 2.5, 3.25], // Clave-like pattern
    shaker: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
  },
  "Rock Anthem": {
    kick_goat: [0, 1.5, 2, 2.5],
    snare: [1, 3],
    crash: [0],                      // Crash on 1
    ride: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
  },
  "Percussion Only": {
    woodblock: [0, 1, 2, 3],
    tambourine: [0.5, 1.5, 2.5, 3.5],
    clave: [0.75, 2.25, 3.75],
    floortom: [3.5]
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