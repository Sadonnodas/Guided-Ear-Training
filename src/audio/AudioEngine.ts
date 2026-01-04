import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { LATENCY_OFFSET, GROOVE_SETTINGS, GROOVE_DEFAULTS } from "../config/AudioConfig";

export class AudioEngine {
  // --- NODES ---
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  
  private vocalGain!: Tone.Gain;
  private droneGain!: Tone.Gain;
  private drumGain!: Tone.Gain;
  private clickGain!: Tone.Gain; 
  private debugClickGain!: Tone.Gain; 

  // --- PLAYERS ---
  private dronePlayerA!: Tone.Player;
  private dronePlayerB!: Tone.Player;
  private activeDrone: 'A' | 'B' = 'A'; 
  private drumPlayer!: Tone.Player;
  private clickSynth!: Tone.Synth; 
  private debugClickSynth!: Tone.MembraneSynth;

  // --- STATE ---
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  private melodyEventIds: number[] = []; 
  private pulseEventId: number | null = null;
  private debugClickEventId: number | null = null;
  
  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null; 
  
  private isInitialized = false;
  private mediaSessionSetup = false;
  private silentHtmlAudio: HTMLAudioElement | null = null;

  constructor() {}

  async init(vols: { drone: number, groove: number, voice: number, click: number, master: number }) {
    if (this.isInitialized) return;

    await Tone.start();
    this.initSilentAudio();

    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6, attack: 0.005, release: 0.2 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(this.masterGain);

    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb); 
    this.droneGain = new Tone.Gain(vols.drone).connect(this.masterGain);
    this.drumGain = new Tone.Gain(vols.groove).connect(this.masterGain);
    this.clickGain = new Tone.Gain(vols.click).connect(this.masterGain);
    
    this.debugClickGain = new Tone.Gain(0).connect(this.masterGain);

    this.dronePlayerA = new Tone.Player({ loop: true, fadeIn: 2, fadeOut: 2 }).connect(this.droneGain);
    this.dronePlayerB = new Tone.Player({ loop: true, fadeIn: 2, fadeOut: 2 }).connect(this.droneGain);
    this.dronePlayerB.volume.value = -Infinity; 

    this.drumPlayer = new Tone.Player({ loop: true, fadeIn: 0.05, fadeOut: 0.05 }).connect(this.drumGain);

    this.clickSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.clickGain);

    this.debugClickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.debugClickGain);

    this.isInitialized = true;
    console.log("Audio Engine Initialized");
  }

  private initSilentAudio() {
    if (this.silentHtmlAudio) return;
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//oeAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAJAAAB3AAZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZ//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAAGGluZwAAAA8AAAAJAAAB3AAZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZ//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAATEAMEAAAAAArmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    audio.loop = true;
    audio.volume = 0.01; 
    this.silentHtmlAudio = audio;
  }

  private setupMediaSession() {
    if (this.mediaSessionSetup || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Guided Ear Training",
      artist: "Studio Session",
      album: "Ear Training App",
      artwork: [{ src: 'https://placehold.co/512x512/png?text=Ear+Trainer', sizes: '512x512', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', () => { if (Tone.Transport.state !== 'started') this.startPlayback(); });
    navigator.mediaSession.setActionHandler('pause', () => { this.pausePlayback(); });
    this.mediaSessionSetup = true;
  }

  async loadBackingTracks(key: MusicalKey, drumFile: string) {
    if (!this.isInitialized) return;
    
    const droneUrl = `${import.meta.env.BASE_URL}loops/drones/${key.toLowerCase()}_drone.mp3`;
    const drumUrl = `${import.meta.env.BASE_URL}loops/drums/${drumFile}`;
    
    try {
      const currentPlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
      const nextPlayer = this.activeDrone === 'A' ? this.dronePlayerB : this.dronePlayerA;

      await nextPlayer.load(droneUrl);

      if (!this.drumPlayer.loaded) await this.drumPlayer.load(drumUrl);
      
      const settings = GROOVE_SETTINGS[drumFile] || GROOVE_DEFAULTS;
      this.drumPlayer.playbackRate = settings.playbackRate; 
      
      if (this.drumPlayer.state !== 'started') {
        this.drumPlayer.sync().start(0, settings.nudge || 0);
      }

      if (Tone.Transport.state === 'started') {
        nextPlayer.volume.value = -Infinity;
        nextPlayer.start(0, 0); 
        nextPlayer.volume.rampTo(0, 4); 
        currentPlayer.volume.rampTo(-Infinity, 4);
        setTimeout(() => { currentPlayer.stop(); }, 4000);
      } else {
        currentPlayer.stop();
        nextPlayer.volume.value = 0; 
      }
      this.activeDrone = this.activeDrone === 'A' ? 'B' : 'A';
    } catch (e) { console.warn("Error loading tracks:", e); }
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

  setDebugClick(active: boolean) {
      if (!this.isInitialized) return;
      this.debugClickGain.gain.rampTo(active ? 0.8 : 0, 0.1);
  }

  startPlayback() {
    if (!this.isInitialized) return;
    this.setupMediaSession(); 
    if (this.silentHtmlAudio && this.silentHtmlAudio.paused) {
        this.silentHtmlAudio.play().catch(e => console.log("Silent audio failed:", e));
    }

    if (Tone.Transport.state !== 'started') {
        Tone.Transport.position = 0;
        this.ensureSystemEventsRunning();

        const activePlayer = this.activeDrone === 'A' ? this.dronePlayerA : this.dronePlayerB;
        if (activePlayer.loaded) {
            activePlayer.volume.rampTo(0, 0.1); 
            activePlayer.start(0, 0);
        }
        
        if (this.drumPlayer.loaded) {
            this.drumPlayer.sync().start(0);
        }

        Tone.Transport.start();
    }
  }

  pausePlayback() {
    Tone.Transport.pause();
  }

  private clearMelodySchedule() {
    this.melodyEventIds.forEach(id => Tone.Transport.clear(id));
    this.melodyEventIds = [];
  }

  private ensureSystemEventsRunning() {
      if (this.pulseEventId !== null) Tone.Transport.clear(this.pulseEventId);
      this.pulseEventId = Tone.Transport.scheduleRepeat((time) => {
          Tone.Draw.schedule(() => {
              if (this.onBeat) this.onBeat(Math.floor(Tone.Transport.position as number));
          }, time);
      }, "4n");

      if (this.debugClickEventId !== null) Tone.Transport.clear(this.debugClickEventId);
      this.debugClickEventId = Tone.Transport.scheduleRepeat((time) => {
          this.debugClickSynth.triggerAttackRelease("C5", "32n", time);
      }, "4n");
  }

  reset() {
    if (!this.isInitialized) return;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    
    this.clearMelodySchedule();
    
    if (this.pulseEventId !== null) Tone.Transport.clear(this.pulseEventId);
    if (this.debugClickEventId !== null) Tone.Transport.clear(this.debugClickEventId);
    
    this.pulseEventId = null;
    this.debugClickEventId = null;
    
    Tone.Transport.cancel(); 

    this.dronePlayerA.stop();
    this.dronePlayerB.stop();
    this.drumPlayer.unsync().stop(); 
    
    if (this.silentHtmlAudio) this.silentHtmlAudio.pause();
  }

  // ... Setters ...
  setBpm(bpm: number) { Tone.Transport.bpm.value = bpm; }
  setMasterVol(v: number) { if(this.isInitialized) this.masterGain.gain.rampTo(v, 0.1); }
  setDroneVol(v: number) { if(this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  setDrumVol(v: number) { if(this.isInitialized) this.drumGain.gain.rampTo(v, 0.1); }
  setVocalVol(v: number) { if(this.isInitialized) this.vocalGain.gain.rampTo(v, 0.1); }
  setClickVol(v: number) { if(this.isInitialized) this.clickGain.gain.rampTo(v, 0.1); }
  setReverbMix(v: number) { if(this.isInitialized) this.reverb.wet.value = v; }

  // =================================================================
  // 5. ROBUST SCHEDULING
  // =================================================================

  scheduleRoutine(notes: NoteEvent[], silentPractice: boolean, isFirstQuestion: boolean, onComplete: () => void): number {
    if (!this.isInitialized) return 0;
    
    this.clearMelodySchedule();
    if (this.pulseEventId === null && Tone.Transport.state === 'started') {
        this.ensureSystemEventsRunning();
    }

    const beatSec = 60 / Tone.Transport.bpm.value;
    const melodyDur = 8 * beatSec; 
    const measureSec = 4 * beatSec; // 1 Measure

    // --- ROCK SOLID GRID ALIGNMENT ---
    let startPoint = 0;

    if (Tone.Transport.state === 'started') {
        const currentTime = Tone.Transport.seconds;
        
        // Manually calculate the next exact measure boundary
        // We use Math.ceil to find the next integer multiple of measureSec
        const nextGridBoundary = Math.ceil(currentTime / measureSec) * measureSec;

        // BUFFER CHECK:
        // We need enough time for the Count-In calculation AND negative offsets.
        // -0.17s latency + 0.1s JS jitter = we need ~0.3s.
        // I am setting it to 0.5s to be absolutely safe.
        const bufferNeeded = 0.5;

        if (nextGridBoundary - currentTime < bufferNeeded) {
             // If we are too close, skip to the FOLLOWING measure
             startPoint = nextGridBoundary + measureSec;
        } else {
             startPoint = nextGridBoundary;
        }
    } else {
        // Stopped (Fresh Start)
        // Start 1 measure in to allow settling
        startPoint = measureSec; 
    }
    
    // Safety for the very first question after modulation or start
    if (isFirstQuestion && startPoint < measureSec) {
        startPoint = measureSec;
    }

    const schedule = (callback: (time: number) => void, time: number) => {
        // Only schedule if time is valid (future)
        if (time >= Tone.Transport.seconds - 0.1) {
             const id = Tone.Transport.schedule(callback, time);
             this.melodyEventIds.push(id);
        }
    };

    // Back-calculated Count In
    for (let i = 0; i < 4; i++) {
        const offsetBeats = 4 - i; 
        const t = startPoint - (offsetBeats * beatSec);
        schedule((time) => {
            Tone.Draw.schedule(() => { if (this.onNotePlay) this.onNotePlay(null, true); }, time);
        }, t);
    }

    const scheduleMelody = (start: number, playAudio: boolean) => {
        notes.forEach(note => {
            const degree = note.noteInfo.degree;
            const offset = LATENCY_OFFSET[degree] || 0;
            const beatTime = start + (note.startTime * beatSec);
            const triggerTime = beatTime + offset; 

            if (playAudio) {
                schedule((time) => {
                    this.playOneShot(note, time);
                }, triggerTime);
            }

            schedule((time) => {
                Tone.Draw.schedule(() => { 
                    if (this.onNotePlay) this.onNotePlay(note, false); 
                }, time);
            }, beatTime);
        });
    };

    let cursor = startPoint;

    // Pass 1
    scheduleMelody(cursor, true);
    cursor += melodyDur;

    // Pass 2
    scheduleMelody(cursor, true);
    cursor += melodyDur;

    // Pass 3 (Silent)
    if (silentPractice) {
        scheduleMelody(cursor, false);
        cursor += melodyDur;
    }

    const endTime = cursor;
    schedule(() => { setTimeout(() => onComplete(), 0); }, endTime);

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