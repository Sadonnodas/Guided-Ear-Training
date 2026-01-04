import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { Metronome } from "./Metronome";
import { BackingTracks } from "./BackingTracks";
import { Scheduler } from "./Scheduler";

export class AudioEngine {
  // Main Graph
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  private vocalGain!: Tone.Gain;

  // Modules
  private metronome!: Metronome;
  private backingTracks!: BackingTracks;
  private scheduler!: Scheduler;

  // Sampler State
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();

  // Public Callbacks
  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null;

  private isInitialized = false;
  private silentHtmlAudio: HTMLAudioElement | null = null;
  private mediaSessionSetup = false;

  // FIX 1: Store state in case setters are called before init
  private pendingDebugActive = false;
  private pendingMetronomeVol = 0.5;

  constructor() {}

  async init(vols: { drone: number, groove: number, voice: number, click: number, master: number }) {
    if (this.isInitialized) return;

    await Tone.start();
    this.initSilentAudio();

    // 1. Setup Graph
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6, attack: 0.005, release: 0.2 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(this.masterGain);
    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb);

    // 2. Initialize Modules
    this.metronome = new Metronome(this.masterGain);
    this.backingTracks = new BackingTracks(this.masterGain);
    
    // 3. Initialize Scheduler with delegates
    this.scheduler = new Scheduler({
        onBeat: (b) => { if (this.onBeat) this.onBeat(b); },
        onTick: (t) => this.metronome.playTick(t),
        onNotePlay: (n, c) => { if (this.onNotePlay) this.onNotePlay(n, c); },
        playNoteAudio: (n, t) => this.playOneShot(n, t)
    });

    // 4. Set Initial Volumes
    this.metronome.setClickVol(vols.click);
    this.backingTracks.setDroneVol(vols.drone);
    this.backingTracks.setDrumVol(vols.groove);

    // FIX 2: Apply pending metronome state immediately
    this.metronome.setDebugVol(this.pendingMetronomeVol);
    this.metronome.setDebugActive(this.pendingDebugActive);

    this.isInitialized = true;
    console.log("Audio Engine Initialized");
  }

  // --- PUBLIC API ---

  async loadBackingTracks(key: MusicalKey, drumFile: string) {
    if (!this.isInitialized) return;
    await this.backingTracks.load(key, drumFile);
  }

  // --- UPDATED SCHEDULE ROUTINE TO FIX OVERLAP BUG ---
  scheduleRoutine(notes: NoteEvent[], silentPractice: boolean, isFirstQuestion: boolean, onComplete: () => void) {
    if (!this.isInitialized) return;
    
    // FIX: Calculate total duration of the melody in seconds
    const beatSec = 60 / Tone.Transport.bpm.value;
    const totalMelodyBeats = notes.reduce((sum, n) => sum + n.duration, 0);
    const melodyDur = totalMelodyBeats * beatSec; 

    // Send the calculated duration into the scheduler, NOT a hardcoded 8 beats
    this.scheduler.scheduleRoutine(notes, silentPractice, isFirstQuestion, onComplete, melodyDur);
  }

  startPlayback() {
    if (!this.isInitialized) return;
    this.setupMediaSession();
    if (this.silentHtmlAudio?.paused) this.silentHtmlAudio.play().catch(() => {});
    
    // FIX 3: Prevent doubling
    if (Tone.Transport.state !== 'started') {
        this.backingTracks.start();
        this.scheduler.start();
    }
  }

  pausePlayback() {
    this.scheduler.pause();
  }

  reset() {
    if (!this.isInitialized) return;
    this.scheduler.stop();
    this.backingTracks.stop();
    if (this.silentHtmlAudio) this.silentHtmlAudio.pause();
  }

  // --- SETTERS ---
  setBpm(bpm: number) { this.scheduler?.setBpm(bpm); }
  setMasterVol(v: number) { if (this.isInitialized) this.masterGain.gain.rampTo(v, 0.1); }
  setReverbMix(v: number) { if (this.isInitialized) this.reverb.wet.value = v; }
  setVocalVol(v: number) { if (this.isInitialized) this.vocalGain.gain.rampTo(v, 0.1); }
  
  // Delegated Setters
  setDroneVol(v: number) { this.backingTracks?.setDroneVol(v); }
  setDrumVol(v: number) { this.backingTracks?.setDrumVol(v); }
  setClickVol(v: number) { this.metronome?.setClickVol(v); }
  
  // FIX 4: Store in pending state
  setMetronomeVol(v: number) { 
      this.pendingMetronomeVol = v;
      this.metronome?.setDebugVol(v); 
  }
  setDebugClick(active: boolean) { 
      this.pendingDebugActive = active;
      this.metronome?.setDebugActive(active); 
  }

  // --- INTERNAL / SAMPLER ---

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

  private playOneShot(note: NoteEvent, time: number) {
    const id = `${note.noteInfo.degree}_${note.noteInfo.midi}`;
    const buffer = this.noteBuffers.get(id);
    if (buffer) {
      const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
      source.fadeOut = 0.1; 
      source.start(time, 0, buffer.duration);
    }
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
}

export const audioEngine = new AudioEngine();