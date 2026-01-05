import * as Tone from "tone";
import type { MusicalKey } from "../types";
import { GROOVE_SETTINGS, GROOVE_DEFAULTS } from "../config/AudioConfig";

const KEYS: MusicalKey[] = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];

export class BackingTracks {
  private droneGain: Tone.Gain;
  private drumGain: Tone.Gain;
  
  private dronePlayerA: Tone.Player;
  private dronePlayerB: Tone.Player;
  private activeDrone: 'A' | 'B' = 'A';
  
  private drumPlayer: Tone.Player;
  private droneBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();

  constructor(destination: Tone.ToneAudioNode) {
    this.droneGain = new Tone.Gain(0).connect(destination);
    this.drumGain = new Tone.Gain(0).connect(destination);

    // Drones use a long fade to feel like a natural transition
    this.dronePlayerA = new Tone.Player({ loop: true, fadeIn: 4, fadeOut: 4 }).connect(this.droneGain);
    this.dronePlayerB = new Tone.Player({ loop: true, fadeIn: 4, fadeOut: 4 }).connect(this.droneGain);
    
    this.drumPlayer = new Tone.Player({ loop: true, fadeIn: 0.1, fadeOut: 0.1 }).connect(this.drumGain);
  }

  /**
   * Pre-fetches the C drone and then background-loads the rest to prevent lag during key changes.
   */
  async preloadDrones() {
    await this.loadBuffer("C");
    const otherKeys = KEYS.filter(k => k !== "C");
    // Load others without 'await' to let them happen in the background
    otherKeys.forEach(k => this.loadBuffer(k).catch(() => {}));
  }

  private async loadBuffer(key: string) {
    if (this.droneBuffers.has(key)) return;

    // USE import.meta.env.BASE_URL to fix GitHub Pages pathing
    const droneUrl = `${import.meta.env.BASE_URL}loops/drones/${key.toLowerCase()}_drone.mp3`;
    
    const buffer = new Tone.ToneAudioBuffer();
    try {
        await buffer.load(droneUrl);
        this.droneBuffers.set(key, buffer);
    } catch (e) {
        console.error(`BackingTracks: Failed to load drone for ${key} at ${droneUrl}`);
    }
  }

  setDroneVol(v: number) { this.droneGain.gain.rampTo(v, 0.1); }
  setDrumVol(v: number) { this.drumGain.gain.rampTo(v, 0.1); }

  /**
   * Loads and transitions to a new key/groove.
   */
  async load(key: MusicalKey, drumFile: string) {
    const drumUrl = `${import.meta.env.BASE_URL}loops/drums/${drumFile}`;

    try {
      // Logic for seamless drone crossfading
      const nextPlayer = this.activeDrone === 'A' ? this.dronePlayerB : this.dronePlayerA;
      const currentPlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;

      // 1. Prepare Drone
      if (this.droneBuffers.has(key)) {
          nextPlayer.buffer = this.droneBuffers.get(key)!;
      } else {
          const droneUrl = `${import.meta.env.BASE_URL}loops/drones/${key.toLowerCase()}_drone.mp3`; 
          await nextPlayer.load(droneUrl);
      }

      // 2. Prepare Drum
      await this.drumPlayer.load(drumUrl);
      const settings = GROOVE_SETTINGS[drumFile] || GROOVE_DEFAULTS;
      this.drumPlayer.playbackRate = settings.playbackRate;

      // 3. If the app is already playing, start immediately
      if (Tone.Transport.state === 'started') {
        // Sync drums to transport
        this.drumPlayer.sync().start(0, settings.nudge || 0);
        
        // Start next drone and fade out current one
        nextPlayer.start(0);
        currentPlayer.stop(); 
      }
      
      this.activeDrone = this.activeDrone === 'A' ? 'B' : 'A';
    } catch (e) {
      console.warn("BackingTracks: Error during load/transition:", e);
    }
  }

  start() {
    const activePlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
    if (activePlayer.loaded) activePlayer.start(0);
    if (this.drumPlayer.loaded) this.drumPlayer.sync().start(0);
  }

  stop() {
    this.dronePlayerA.stop();
    this.dronePlayerB.stop();
    this.drumPlayer.unsync().stop();
  }
}