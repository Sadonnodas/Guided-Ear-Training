import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { Metronome } from "./Metronome";
import { DrumMachine } from "./DrumMachine";
import { Scheduler } from "./Scheduler";
import { TRAINING_WHEELS_CONFIG, DRUM_PATTERNS, LATENCY_OFFSET } from "../config/AudioConfig";

export class AudioEngine {
  // ... (Keep existing properties)
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  private vocalGain!: Tone.Gain;
  private droneGain!: Tone.Gain;
  private dronePlayer!: Tone.Player;
  private trainingSynth!: Tone.Synth;
  private trainingGain!: Tone.Gain;
  private trainingVol: number = 0.3;
  private transitionSynth!: Tone.MetalSynth;
  private metronome!: Metronome;
  private drumMachine!: DrumMachine;
  private scheduler!: Scheduler;
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  private currentTonic: string = "C"; 
  private isInitialized = false;

  // CALLBACKS
  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null;
  // NEW
  public onStatusChange: ((text: string) => void) | null = null;

  public async init(vols: { groove: number, voice: number, click: number, master: number, drone: number }) {
    if (this.isInitialized) return;
    await Tone.start();
    
    // ... (Keep existing audio graph setup: compressor, gains, synths, etc.)
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);

    this.droneGain = new Tone.Gain(vols.drone).connect(this.masterGain);
    this.dronePlayer = new Tone.Player({ loop: true, fadeIn: 4, fadeOut: 4 }).connect(this.droneGain);

    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).connect(this.masterGain);
    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb);

    this.trainingSynth = new Tone.Synth({
        oscillator: TRAINING_WHEELS_CONFIG.oscillator,
        envelope: TRAINING_WHEELS_CONFIG.envelope
    });
    this.trainingGain = new Tone.Gain(0).connect(this.masterGain);
    this.trainingSynth.connect(this.trainingGain);

    this.transitionSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
        volume: -15
    }).connect(this.masterGain);

    this.metronome = new Metronome(this.masterGain);
    this.drumMachine = new DrumMachine(this.masterGain);
    
    // UPDATE SCHEDULER INITIALIZATION
    this.scheduler = new Scheduler({
        onBeat: (b) => { if (this.onBeat) this.onBeat(b); },
        onTick: (t) => this.metronome.playTick(t),
        onNotePlay: (n, c) => { if (this.onNotePlay) this.onNotePlay(n, c); },
        playNoteAudio: (n, t, useSynth) => this.playMelodyNote(n, t, useSynth),
        onStart: (t) => this.playTransitionSound(t),
        // Connect the new status callback
        onStatusChange: (text) => { if (this.onStatusChange) this.onStatusChange(text); }
    });

    this.drumMachine.setVolume(vols.groove);
    this.metronome.setClickVol(vols.click);
    this.isInitialized = true;
  }

  // ... (Keep existing playMelodyNote, setDrumPattern, setBpm, loadBackingTracks methods)
  // ... (Keep existing startPlayback, reset, volume setters, preloadNotes, playTransitionSound)
  
  // COPY-PASTE helpers from previous file to ensure completeness if you are overwriting:
  private playMelodyNote(note: NoteEvent, time: number, useSynth: boolean) {
    if (useSynth) {
        this.trainingGain.gain.setValueAtTime(this.trainingVol, time);
        this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, note.duration, time);
    } else {
        const degree = note.noteInfo.degree;
        const id = `${degree}_${note.noteInfo.midi}`;
        const buffer = this.noteBuffers.get(id);
        if (buffer) {
            const offset = LATENCY_OFFSET[degree] || 0;
            const triggerTime = time + offset;
            const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
            source.start(Math.max(0, triggerTime), 0, buffer.duration);
        }
    }
  }

  public setDrumPattern(name: string) { if (this.isInitialized) this.drumMachine.setPattern(name as keyof typeof DRUM_PATTERNS); }
  public setBpm(bpm: number) { if (this.isInitialized) this.scheduler.setBpm(bpm); }

  public async loadBackingTracks(key: MusicalKey, _unused: string) {
    if (!this.isInitialized) return;
    this.currentTonic = typeof key === 'string' ? key : (key as any).tonic;
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const tonicLower = this.currentTonic.toLowerCase();
    const droneUrl = `${baseUrl}loops/drones/${tonicLower}_drone.mp3`;
    try {
        await this.dronePlayer.load(droneUrl);
        if (Tone.Transport.state === 'started') this.dronePlayer.stop().start(0);
    } catch (e) { console.error(`AudioEngine: Failed to load drone at ${droneUrl}`, e); }
    this.drumMachine.sync(); 
  }

  public scheduleRoutine(notes: NoteEvent[], silent: boolean, wheels: boolean, isFirst: boolean, onComplete: (nextStartTime: number) => void, startTime?: number) {
    if (!this.isInitialized) return;
    const beatSec = 60 / Tone.Transport.bpm.value;
    const melodyDur = notes.reduce((sum, n) => sum + n.duration, 0) * beatSec; 
    this.scheduler.scheduleRoutine(notes, silent, wheels, isFirst, onComplete, melodyDur, startTime);
  }

  public startPlayback() {
    if (!this.isInitialized) return;
    if (Tone.Transport.state !== 'started') {
        if (this.dronePlayer.loaded) this.dronePlayer.start(0);
        this.drumMachine.sync();
        this.scheduler.start();
    }
  }

  public reset() {
    if (!this.isInitialized) return;
    this.scheduler.stop(); 
    this.drumMachine.unsync();
    this.dronePlayer.stop(); 
    Tone.Transport.cancel();
    this.trainingSynth.triggerRelease();
  }

  public setDroneVol(v: number) { if (this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  public setDrumVol(v: number) { this.drumMachine?.setVolume(v); }
  public setVocalVol(v: number) { this.vocalGain?.gain.rampTo(v, 0.1); }
  public setMasterVol(v: number) { this.masterGain?.gain.rampTo(v, 0.1); }
  public setClickVol(v: number) { this.metronome?.setClickVol(v); }
  public setDebugClick(active: boolean) { this.metronome?.setDebugActive(active); }
  public setTrainingVol(v: number) { this.trainingVol = v; }

  public async preloadNotes(notes: NoteEvent[]) {
    const uniqueIds = Array.from(new Set(notes.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`)));
    const promises = uniqueIds.map(async (id) => {
      if (this.noteBuffers.has(id)) return;
      const degree = id.split('_')[0]; 
      const url = `${import.meta.env.BASE_URL}samples/${degree}/${id}.mp3`;
      try {
        const buffer = new Tone.ToneAudioBuffer();
        await buffer.load(url);
        this.noteBuffers.set(id, buffer);
      } catch (e) { console.error("Sample load failed:", url); }
    });
    await Promise.all(promises);
  }

  private playTransitionSound(time: number) {
      const noteToPlay = `${this.currentTonic}3`;
      this.transitionSynth?.triggerAttackRelease(noteToPlay, "16n", time, 0.5);
  }
}
export const audioEngine = new AudioEngine();