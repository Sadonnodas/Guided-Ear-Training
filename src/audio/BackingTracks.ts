import * as Tone from "tone";
import type { MusicalKey } from "../types";
import { GROOVE_SETTINGS, GROOVE_DEFAULTS } from "../config/AudioConfig";

export class BackingTracks {
  private droneGain: Tone.Gain;
  private drumGain: Tone.Gain;
  
  private dronePlayerA: Tone.Player;
  private dronePlayerB: Tone.Player;
  private activeDrone: 'A' | 'B' = 'A';
  
  private drumPlayer: Tone.Player;

  constructor(destination: Tone.ToneAudioNode) {
    this.droneGain = new Tone.Gain(0).connect(destination);
    this.drumGain = new Tone.Gain(0).connect(destination);

    // Longer fade times for smoother key transitions
    this.dronePlayerA = new Tone.Player({ loop: true, fadeIn: 6, fadeOut: 6 }).connect(this.droneGain);
    this.dronePlayerB = new Tone.Player({ loop: true, fadeIn: 6, fadeOut: 6 }).connect(this.droneGain);
    this.dronePlayerB.volume.value = -Infinity;

    this.drumPlayer = new Tone.Player({ loop: true, fadeIn: 0.05, fadeOut: 0.05 }).connect(this.drumGain);
  }

  setDroneVol(v: number) {
    this.droneGain.gain.rampTo(v, 0.1);
  }

  setDrumVol(v: number) {
    this.drumGain.gain.rampTo(v, 0.1);
  }

  async load(key: MusicalKey, drumFile: string) {
    const droneUrl = `${import.meta.env.BASE_URL}loops/drones/${key.toLowerCase()}_drone.mp3`;
    const drumUrl = `${import.meta.env.BASE_URL}loops/drums/${drumFile}`;

    try {
      const currentPlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
      const nextPlayer = this.activeDrone === 'A' ? this.dronePlayerB : this.dronePlayerA;

      // CRITICAL: Load the new drone FIRST, before starting any crossfade
      await nextPlayer.load(droneUrl);

      if (!this.drumPlayer.loaded) await this.drumPlayer.load(drumUrl);

      const settings = GROOVE_SETTINGS[drumFile] || GROOVE_DEFAULTS;
      this.drumPlayer.playbackRate = settings.playbackRate;

      // Crossfade logic - now guaranteed that nextPlayer is fully loaded
      if (Tone.Transport.state === 'started') {
        // Sync new drum settings live
        if (this.drumPlayer.state !== 'started') {
           this.drumPlayer.sync().start(0, settings.nudge || 0);
        }

        // Start new drone at silence, then fade in over 6 seconds
        nextPlayer.volume.value = -Infinity;
        nextPlayer.start(0, 0);
        
        // Use setTimeout to ensure the ramp starts AFTER the player has actually started
        setTimeout(() => {
          nextPlayer.volume.rampTo(0, 6);
        }, 50);
        
        // Fade out old drone over 6 seconds
        currentPlayer.volume.rampTo(-Infinity, 6);
        setTimeout(() => { currentPlayer.stop(); }, 6000);
      } else {
        // Prepare for next start
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
    if (this.drumPlayer.loaded) {
      this.drumPlayer.sync().start(0);
    }
  }

  stop() {
    this.dronePlayerA.stop();
    this.dronePlayerB.stop();
    this.drumPlayer.unsync().stop();
  }
}