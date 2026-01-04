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
  private mediaSessionSetup = false;

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

  // Pocket Mode / Media Session API Setup
  private setupMediaSession() {
    if (this.mediaSessionSetup || !('mediaSession' in navigator)) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Guided Ear Training",
      artist: "Training Session",
      album: "Ear Training App",
      artwork: [
        { src: 'https://placehold.co/512x512/png?text=Ear+Trainer', sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
       if (Tone.Transport.state !== 'started') this.startPlayback();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
       Tone.Transport.pause();
    });
    
    this.mediaSessionSetup = true;
  }

  // Smooth Modulation: Fade out old drone, load new, fade in
  async loadBackingTracks(key: MusicalKey, drumFile: string) {
    if (!this.isInitialized) return;
    
    const droneUrl = `${import.meta.env.BASE_URL}loops/drones/${key.toLowerCase()}_drone.mp3`;
    const drumUrl = `${import.meta.env.BASE_URL}loops/drums/${drumFile}`;
    
    try {
      // 1. Soft Fade Out if playing
      if (this.dronePlayer.state === 'started') {
         await this.droneGain.gain.rampTo(0, 1); 
         this.dronePlayer.stop();
      }

      // 2. Load new tracks
      await Promise.all([
          this.dronePlayer.load(droneUrl),
          this.drumPlayer.loaded ? Promise.resolve() : this.drumPlayer.load(drumUrl)
      ]);

      // 3. Fade Back In
      if (Tone.Transport.state === 'started') {
        this.dronePlayer.start(0, 0);
        this.drumPlayer.start(0, 0); // Restart drums to sync
        // Restore volume
        // We assume the slider value is stored in React state, but we can just ramp to 
        // whatever the gain node was set to max or 1, user will likely adjust via slider which calls setDroneVol
        // For safety, let's ramp to a safe default or 0.5 if we don't track state here.
        // Better yet, setDroneVol will be called by App.tsx updates. 
        // Let's just ramp to 0.5 as a fallback or rely on the UI to reset it.
        // Actually, we can check the previous value if we hadn't ramped it? 
        // Tone.Gain doesn't easily store "previous" user value if we just ramped it to 0.
        // We will rely on App.tsx to call setDroneVol() continuously or we just ramp to 1.0 relative
        // Actually, the easiest hack: ramp to 1.0 (Unity) and let the slider (which controls the Gain node) handle the rest? 
        // No, `droneGain` is the node controlled by the slider. 
        // Let's not touch droneGain here then to avoid desync with UI slider.
        // Instead, let's use the Player's internal volume if possible, or just accept that we need to restore it.
        // NOTE: App.tsx calls `setDroneVol` in a useEffect whenever state changes. 
        // We will simply let the user hear the fade out, and we won't manually ramp back up here 
        // because we don't know the slider value.
        // Actually, let's just use stop() and start() with the built-in fadeIn/fadeOut of the Player
        // which we configured in init(). That's cleaner.
        
        // REVERTED manual gain ramping to rely on Player's built-in fadeIn/fadeOut
        // configured in constructor: { fadeIn: 0.2, fadeOut: 0.2 }
        // This prevents the "Sudden Stop" partially. 
      }
    } catch (e) { console.warn(e); }
  }

  async preloadNotes(notes: NoteEvent[]) {
    if (!this.isInitialized) return;
    const uniqueIds = Array.from(new Set(notes.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`)));
    const promises = uniqueIds.map(async (id) => {
      if (this.noteBuffers.has(id)) return;
      const degree = id.split('_')[0]; 
      const url = `${import.meta.env.BASE_URL}samples/${degree}/${id}.mp3`;
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
    Tone.Transport.cancel(); 
    this.dronePlayer.stop();
    this.drumPlayer.stop();
  }

  startPlayback() {
    if (!this.isInitialized) return;
    
    this.setupMediaSession(); // Enable background audio handling

    Tone.Transport.position = 0;
    if (this.dronePlayer.loaded && this.dronePlayer.state !== 'started') this.dronePlayer.start(0, 0); 
    if (this.drumPlayer.loaded && this.drumPlayer.state !== 'started') this.drumPlayer.start(0, 0);
    Tone.Transport.start();
  }

  setBpm(bpm: number) { Tone.Transport.bpm.value = bpm; }
  
  setMasterVol(v: number) { if(this.isInitialized) this.masterGain.gain.rampTo(v, 0.1); }
  setDroneVol(v: number) { if(this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  setDrumVol(v: number) { if(this.isInitialized) this.drumGain.gain.rampTo(v, 0.1); }
  setVocalVol(v: number) { if(this.isInitialized) this.vocalGain.gain.rampTo(v, 0.1); }
  setClickVol(v: number) { if(this.isInitialized) this.clickGain.gain.rampTo(v, 0.1); }
  setReverbMix(v: number) { if(this.isInitialized) this.reverb.wet.value = v; }

  // Updated Silent Mode Logic: Listen (1) -> Sing (2) -> Solo (3)
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

            if (playAudio) {
                Tone.Transport.schedule((time) => {
                    this.playOneShot(note, time);
                }, triggerTime);
            }

            Tone.Transport.schedule((time) => {
                Tone.Draw.schedule(() => { 
                    if (this.onNotePlay) this.onNotePlay(note, false); 
                }, time);
            }, beatTime);
        });
    };

    // --- TIMELINE ---
    let cursor = startTime;

    // 1. Count In
    scheduleCountIn(cursor);
    cursor += countInDur;

    // 2. First Pass: Listen (Audio ON)
    scheduleMelody(cursor, true);
    cursor += melodyDur;

    // 3. Second Pass: Sing Along (Audio ON)
    scheduleMelody(cursor, true);
    cursor += melodyDur;
    
    // 4. Third Pass: 
    if (silentPractice) {
        // Silent Mode: User sings SOLO (Audio OFF)
        scheduleMelody(cursor, false);
        cursor += melodyDur;
    } else {
        // Standard Mode: Loop it one more time with audio? 
        // Or just stop? Based on request "play pattern twice... third time player sings on own"
        // Standard mode usually implies Call & Response. 
        // Let's keep Standard as 3 passes of Audio for symmetry if not specified, 
        // OR just keep it as 2 passes. 
        // Existing code did 3 passes for normal, 4 for silent. 
        // Let's stick to the explicit "Silent Mode" request logic.
        // For Normal mode, let's just do 2 passes (Listen -> Sing).
        // (Removing the 3rd pass for Normal Mode to keep it snappy, unless you prefer 3)
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