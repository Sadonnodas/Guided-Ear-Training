import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { Metronome } from "./Metronome";
import { BackingTracks } from "./BackingTracks";
import { Scheduler } from "./Scheduler";

export class AudioEngine {
  // Main Graph
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  
  // 1. VOCAL REVERB (Clean/Tight)
  private reverb!: Tone.Reverb;
  private vocalGain!: Tone.Gain;

  // 2. SFX CHAIN (Parallel Routing)
  private sfxReverb!: Tone.Reverb;
  private sfxGain!: Tone.Gain;
  
  // Delay Loop
  private chimeDelay!: Tone.FeedbackDelay; 
  private delayGain!: Tone.Gain; 
  private transitionSynth!: Tone.MetalSynth;

  // State
  private currentTonic: string = "C"; 

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
  private mediaSessionSetup = false;
  private silentHtmlAudio: HTMLAudioElement | null = null;
  private pendingDebugActive = false;
  private pendingMetronomeVol = 0.5;

  constructor() {
    this.createSilentAudio();
  }

  private createSilentAudio() {
    if (typeof window === 'undefined') return;
    const audio = document.createElement('audio');
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//oeAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAJAAAB3AAZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZ//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAAGGluZwAAAA8AAAAJAAAB3AAZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZ//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAATEAMEAAAAAArmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//oeAAAB3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.01; 
    audio.style.position = 'fixed';
    audio.style.left = '0';
    audio.style.top = '0';
    audio.style.width = '1px';
    audio.style.height = '1px';
    audio.style.opacity = '0.001';
    audio.style.pointerEvents = 'none';
    audio.style.zIndex = '-999';
    document.body.appendChild(audio);
    this.silentHtmlAudio = audio;
  }

  prepareAudio() {
     if (Tone.context.state !== 'running') {
         Tone.context.resume().catch(() => {});
     }
     if (this.silentHtmlAudio) {
         this.silentHtmlAudio.play().catch(e => console.log("Silent audio start failed:", e));
     }
  }

  async init(vols: { drone: number, groove: number, voice: number, click: number, master: number }) {
    if (this.isInitialized) return;

    await Tone.start();
    
    // --- MASTER CHAIN ---
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6, attack: 0.005, release: 0.2 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);

    // --- 1. VOCAL REVERB (Clean) ---
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).connect(this.masterGain);
    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb);

    // --- 2. SFX REVERB (Dreamy) ---
    this.sfxReverb = new Tone.Reverb({ decay: 5.0, wet: 0.6 }).connect(this.masterGain);
    
    // Main SFX Volume (0.1)
    this.sfxGain = new Tone.Gain(0.1).connect(this.sfxReverb); 

    // --- 3. DELAY PATH (Vintage Echo) ---
    // FIXED TIME in Seconds (0.562 = 562ms)
    // 562ms is approx dotted 8th note at 80 BPM
    // Adjust this number to taste (e.g. 0.400 for 400ms)
    this.chimeDelay = new Tone.FeedbackDelay(0.564, 0.4); 
    
    this.chimeDelay.wet.value = 1; // 100% Wet (Only output echoes)
    
    // Delay Volume: 0.5 (Echoes are quieter than the main hit)
    this.delayGain = new Tone.Gain(0.3).connect(this.sfxGain);
    this.chimeDelay.connect(this.delayGain);

    // --- 4. SYNTH ---
    this.transitionSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 }, 
        harmonicity: 3.1,    
        modulationIndex: 16, 
        resonance: 3000,     
        octaves: 1.0
    });

    // --- PARALLEL ROUTING ---
    // Path A: Direct Hit
    this.transitionSynth.connect(this.sfxGain);
    
    // Path B: Delay
    this.transitionSynth.connect(this.chimeDelay);

    this.metronome = new Metronome(this.masterGain);
    this.backingTracks = new BackingTracks(this.masterGain);
    
    this.scheduler = new Scheduler({
        onBeat: (b) => { if (this.onBeat) this.onBeat(b); },
        onTick: (t) => this.metronome.playTick(t),
        onNotePlay: (n, c) => { if (this.onNotePlay) this.onNotePlay(n, c); },
        playNoteAudio: (n, t) => this.playOneShot(n, t),
        onStart: (t) => this.playTransitionSound(t)
    });

    this.metronome.setClickVol(vols.click);
    this.backingTracks.setDroneVol(vols.drone);
    this.backingTracks.setDrumVol(vols.groove);

    this.metronome.setDebugVol(this.pendingMetronomeVol);
    this.metronome.setDebugActive(this.pendingDebugActive);

    if (this.silentHtmlAudio && this.silentHtmlAudio.paused) {
        this.silentHtmlAudio.play().catch(() => {});
    }

    this.isInitialized = true;
    console.log("Audio Engine Initialized");
  }

  // --- PUBLIC API ---

  async loadBackingTracks(key: MusicalKey, drumFile: string) {
    if (!this.isInitialized) return;
    
    // Capture tonic
    if (key && typeof key === 'object' && 'tonic' in key) {
        this.currentTonic = (key as any).tonic;
    } else if (typeof key === 'string') {
        this.currentTonic = key;
    }

    await this.backingTracks.load(key, drumFile);
  }

  scheduleRoutine(notes: NoteEvent[], silentPractice: boolean, isFirstQuestion: boolean, onComplete: () => void) {
    if (!this.isInitialized) return;

    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.backingTracks.stop(); 
    
    const beatSec = 60 / Tone.Transport.bpm.value;
    const totalMelodyBeats = notes.reduce((sum, n) => sum + n.duration, 0);
    const melodyDur = totalMelodyBeats * beatSec; 
    
    this.scheduler.scheduleRoutine(notes, silentPractice, isFirstQuestion, onComplete, melodyDur);
  }

  startPlayback() {
    if (!this.isInitialized) return;
    this.setupMediaSession();
    
    if (this.silentHtmlAudio && this.silentHtmlAudio.paused) {
        this.silentHtmlAudio.play().catch(() => {});
    }
    
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
    
    if (this.silentHtmlAudio) {
        this.silentHtmlAudio.pause();
        this.silentHtmlAudio.currentTime = 0;
    }
  }

  // --- SETTERS ---
  setBpm(bpm: number) { this.scheduler?.setBpm(bpm); }
  setMasterVol(v: number) { if (this.isInitialized) this.masterGain.gain.rampTo(v, 0.1); }
  setReverbMix(v: number) { if (this.isInitialized) this.reverb.wet.value = v; }
  setVocalVol(v: number) { if (this.isInitialized) this.vocalGain.gain.rampTo(v, 0.1); }
  setDroneVol(v: number) { this.backingTracks?.setDroneVol(v); }
  setDrumVol(v: number) { this.backingTracks?.setDrumVol(v); }
  setClickVol(v: number) { this.metronome?.setClickVol(v); }
  
  setMetronomeVol(v: number) { 
      this.pendingMetronomeVol = v;
      this.metronome?.setDebugVol(v); 
  }
  setDebugClick(active: boolean) { 
      this.pendingDebugActive = active;
      this.metronome?.setDebugActive(active); 
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

  private playOneShot(note: NoteEvent, time: number) {
    const id = `${note.noteInfo.degree}_${note.noteInfo.midi}`;
    const buffer = this.noteBuffers.get(id);
    if (buffer) {
      const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
      source.fadeOut = 0.1; 
      source.start(time, 0, buffer.duration);
    }
  }

  // --- TRIGGER CHIME ---
  private playTransitionSound(time: number) {
      if (this.transitionSynth) {
          const noteToPlay = `${this.currentTonic}3`;
          this.transitionSynth.triggerAttackRelease(noteToPlay, "16n", time, 0.5);
      }
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