import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";

// Latency Configuration (Seconds)
const LATENCY_OFFSET: Record<string, number> = {
  "1": -0.07, "2": -0.1, "3": -0.1, "4": -0.1, 
  "5": -0.17, "6": -0.15, "7": -0.15, 
};

export class AudioEngine {
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  
  private vocalGain!: Tone.Gain;
  private droneGain!: Tone.Gain;
  private drumGain!: Tone.Gain;
  private clickGain!: Tone.Gain; 

  private dronePlayer!: Tone.Player;
  private drumPlayer!: Tone.Player;
  private clickSynth!: Tone.Synth; 

  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  
  private isInitialized = false;

  constructor() {}

  async init(vols: { drone: number, groove: number, voice: number, click: number, master: number }) {
    if (this.isInitialized) return;

    await Tone.start();
    
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6, attack: 0.005, release: 0.2 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);
    
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(this.masterGain);

    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb); 
    this.droneGain = new Tone.Gain(vols.drone).connect(this.masterGain);
    this.drumGain = new Tone.Gain(vols.groove).connect(this.masterGain);
    this.clickGain = new Tone.Gain(vols.click).connect(this.masterGain);

    this.dronePlayer = new Tone.Player({ loop: true, fadeIn: 0.2, fadeOut: 0.2 }).connect(this.droneGain);
    this.drumPlayer = new Tone.Player({ loop: true, fadeIn: 0.2, fadeOut: 0.2 }).connect(this.drumGain);

    this.clickSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.clickGain);

    this.isInitialized = true;
    console.log("Audio Engine Initialized");
  }

  async loadBackingTracks(key: MusicalKey, drumFile: string) {
    if (!this.isInitialized) return;
    const droneUrl = `/loops/drones/${key.toLowerCase()}_drone.mp3`;
    const drumUrl = `/loops/drums/${drumFile}`;
    try {
      this.dronePlayer.stop();
      this.drumPlayer.stop();
      await Promise.all([
          this.dronePlayer.load(droneUrl),
          this.drumPlayer.loaded ? Promise.resolve() : this.drumPlayer.load(drumUrl)
      ]);
    } catch (e) { console.warn(e); }
  }

  async preloadNotes(notes: NoteEvent[]) {
    if (!this.isInitialized) return;
    const uniqueIds = Array.from(new Set(notes.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`)));
    const promises = uniqueIds.map(async (id) => {
      if (this.noteBuffers.has(id)) return;
      const degree = id.split('_')[0]; 
      const url = `/samples/${degree}/${id}.mp3`;
      try {
        const buffer = new Tone.ToneAudioBuffer();
        await buffer.load(url);
        this.noteBuffers.set(id, buffer);
      } catch (e) { console.error(e); }
    });
    await Promise.all(promises);
  }

  reset() {
    if (!this.isInitialized) return;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel(); // Clears all scheduled events
    this.dronePlayer.stop();
    this.drumPlayer.stop();
  }

  startPlayback() {
    if (!this.isInitialized) return;
    Tone.Transport.position = 0;
    if (this.dronePlayer.loaded) this.dronePlayer.start(0, 0); 
    if (this.drumPlayer.loaded) this.drumPlayer.start(0, 0);
    Tone.Transport.start();
  }

  setBpm(bpm: number) { Tone.Transport.bpm.value = bpm; }
  
  setMasterVol(v: number) { if(this.isInitialized) this.masterGain.gain.rampTo(v, 0.1); }
  setDroneVol(v: number) { if(this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  setDrumVol(v: number) { if(this.isInitialized) this.drumGain.gain.rampTo(v, 0.1); }
  setVocalVol(v: number) { if(this.isInitialized) this.vocalGain.gain.rampTo(v, 0.1); }
  setClickVol(v: number) { if(this.isInitialized) this.clickGain.gain.rampTo(v, 0.1); }
  setReverbMix(v: number) { if(this.isInitialized) this.reverb.wet.value = v; }

  scheduleRoutine(notes: NoteEvent[], silentPractice: boolean, onComplete: () => void): number {
    if (!this.isInitialized) return 0;
    
    const startTime = 0; 
    const beatSec = 60 / Tone.Transport.bpm.value;
    const melodyDur = 8 * beatSec; 
    const countInDur = 4 * beatSec;

    const scheduleCountIn = (start: number) => {
        for (let i = 0; i < 4; i++) {
            const t = start + (i * beatSec);
            Tone.Transport.schedule((time) => {
                // Silent Audio Count-in (Audio removed as requested)
                // Visual only:
                Tone.Draw.schedule(() => { if (this.onNotePlay) this.onNotePlay(null, true); }, time);
            }, t);
        }
    };

    const scheduleMelody = (start: number, playAudio: boolean) => {
        notes.forEach(note => {
            const degree = note.noteInfo.degree;
            const offset = LATENCY_OFFSET[degree] || 0;
            
            const beatTime = start + (note.startTime * beatSec);
            const triggerTime = beatTime + offset; 

            // 1. SCHEDULE AUDIO (Early, at triggerTime)
            if (playAudio) {
                Tone.Transport.schedule((time) => {
                    this.playOneShot(note, time);
                }, triggerTime);
            }

            // 2. SCHEDULE VISUALS (Exact, at beatTime)
            // Separating this from the audio schedule ensures it doesn't get lost
            // or miscalculated due to the negative offset.
            Tone.Transport.schedule((time) => {
                Tone.Draw.schedule(() => { 
                    if (this.onNotePlay) this.onNotePlay(note, false); 
                }, time);
            }, beatTime);
        });
    };

    // --- TIMELINE ---
    scheduleCountIn(startTime);

    let cursor = startTime + countInDur;
    scheduleMelody(cursor, true);

    cursor += melodyDur;
    scheduleMelody(cursor, true);

    cursor += melodyDur;
    
    if (silentPractice) {
        scheduleMelody(cursor, false);
        cursor += melodyDur;
        scheduleMelody(cursor, false);
        cursor += melodyDur;
    } else {
        scheduleMelody(cursor, true);
        cursor += melodyDur;
    }

    const endTime = cursor;
    
    Tone.Transport.schedule(() => {
        setTimeout(() => onComplete(), 0);
    }, endTime);

    return endTime;
  }

  private playOneShot(note: NoteEvent, time: number) {
    const id = `${note.noteInfo.degree}_${note.noteInfo.midi}`;
    const buffer = this.noteBuffers.get(id);
    if (buffer) {
      const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
      source.fadeOut = 0.1; 
      source.start(time, 0, buffer.duration);
    }
  }
}

export const audioEngine = new AudioEngine();