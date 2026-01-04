// src/config/AudioConfig.ts

// Adjusts when the melody notes play relative to the beat (in seconds)
export const LATENCY_OFFSET: Record<string, number> = {
  "1": -0.07, "2": -0.1, "3": -0.1, "4": -0.1, 
  "5": -0.17, "6": -0.15, "7": -0.15, 
};

// GLOBAL VISUAL SYNC
export const PULSE_OFFSET_MS = 0;

interface GrooveSettings {
  playbackRate: number; // 1.0 = normal. >1 is faster, <1 is slower
  volumeOffset: number; 
  nudge: number; // NEW: Shift drums forward/backward in seconds (e.g. 0.05)
}

export const GROOVE_DEFAULTS: GrooveSettings = { playbackRate: 1.0, volumeOffset: 0, nudge: 0 };

export const GROOVE_SETTINGS: Record<string, GrooveSettings> = {
  "groove_1_80bpm.mp3": { 
    // IF DRUMS ARE TOO SLOW (Melody is ahead): Increase rate (e.g. 1.002)
    // IF DRUMS ARE TOO FAST (Melody lags): Decrease rate (e.g. 0.998)
    playbackRate: 1.0045, 
    volumeOffset: 0,
    // If the "1" of the drum loop sounds late, make this negative (e.g. -0.05)
    nudge: 0 
  },
};