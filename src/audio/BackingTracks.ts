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

    this.dronePlayerA = new Tone.Player({ loop: true, fadeIn: 6, fadeOut: 6 }).connect(this.droneGain);
    this.dronePlayerB = new Tone.Player({ loop: true, fadeIn: 6, fadeOut: 6 }).connect(this.droneGain);
    this.dronePlayerB.volume.value = -Infinity;

    this.drumPlayer = new Tone.Player({ loop: true, fadeIn: 0.05, fadeOut: 0.05 }).connect(this.drumGain);
  }

  async preloadDrones() {
    console.log("Starting Drone Preload...");
    await this.loadBuffer("C");
    const otherKeys = KEYS.filter(k => k !== "C");
    otherKeys.forEach(k => {
        this.loadBuffer(k).catch(e => console.warn(`Background load failed for ${k}`, e));
    });
  }

  private async loadBuffer(key: string) {
    if (this.droneBuffers.has(key)) return;

    // FIX: Removed BASE_URL. Hardcoded '/' ensures we look at the root of the server.
    const droneUrl = `loops/drones/${key.toLowerCase()}_drone.mp3`;
    
    const buffer = new Tone.ToneAudioBuffer();
    try {
        await buffer.load(droneUrl);
        this.droneBuffers.set(key, buffer);
        console.log(`Success loading: ${key}`);
    } catch (e: any) {
        console.error(`FAILED loading ${key} at URL: ${droneUrl}`);
    }
  }

  setDroneVol(v: number) { this.droneGain.gain.rampTo(v, 0.1); }
  setDrumVol(v: number) { this.drumGain.gain.rampTo(v, 0.1); }

  async load(key: MusicalKey, drumFile: string) {
    // FIX: Hardcoded '/' here too
    const drumUrl = `/loops/drums/${drumFile}`;

    try {
      const currentPlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
      const nextPlayer = this.activeDrone === 'A' ? this.dronePlayerB : this.dronePlayerA;

      if (this.droneBuffers.has(key)) {
          nextPlayer.buffer = this.droneBuffers.get(key)!;
      } else {
          console.warn(`Buffer missing for ${key}, loading on fly...`);
          const droneUrl = `/loops/drones/${key.toLowerCase()}_drone.mp3`; 
          await nextPlayer.load(droneUrl);
      }

      if (!this.drumPlayer.loaded) await this.drumPlayer.load(drumUrl);

      const settings = GROOVE_SETTINGS[drumFile] || GROOVE_DEFAULTS;
      this.drumPlayer.playbackRate = settings.playbackRate;

      nextPlayer.volume.value = -Infinity;
      if (Tone.Transport.state === 'started') {
        if (this.drumPlayer.state !== 'started') this.drumPlayer.sync().start(0, settings.nudge || 0);
        nextPlayer.start(0, 0);
        setTimeout(() => { nextPlayer.volume.rampTo(0, 6); }, 50);
        currentPlayer.volume.rampTo(-Infinity, 6);
        setTimeout(() => { currentPlayer.stop(); }, 6000);
      } else {
        currentPlayer.stop();
        nextPlayer.volume.value = 0; 
      }
      this.activeDrone = this.activeDrone === 'A' ? 'B' : 'A';
    } catch (e) {
      console.warn("Error loading tracks:", e);
    }
  }

  start() {
    const activePlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
    if (activePlayer.loaded) {
      activePlayer.volume.rampTo(0, 0.1);
      activePlayer.start(0, 0);
    }
    if (this.drumPlayer.loaded) this.drumPlayer.sync().start(0);
  }

  stop() {
    this.dronePlayerA.stop();
    this.dronePlayerB.stop();
    this.drumPlayer.unsync().stop();
  }
}