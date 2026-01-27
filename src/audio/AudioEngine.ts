import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { Metronome } from "./Metronome";
import { DrumMachine } from "./DrumMachine";
import { Scheduler } from "./Scheduler";
import { startKeepAlive, stopKeepAlive } from "./KeepAlive";

// Vocal sample range constants - these are the MIDI notes we have samples for
// Export these so MelodyGenerator can use them to constrain note generation
export const MIN_VOCAL_MIDI = 43; // G2
export const MAX_VOCAL_MIDI = 67; // G4

export class AudioEngine {
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  private vocalGain!: Tone.Gain;
  private droneGain!: Tone.Gain;
  private dronePlayer!: Tone.Player;
  private trainingSynth!: Tone.Synth;
  private trainingGain!: Tone.Gain;
  private trainingVol: number = 0.75;
  private transitionSynth!: Tone.MetalSynth;
  private metronome!: Metronome;
  private drumMachine!: DrumMachine;
  private scheduler!: Scheduler;
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  private currentTonic: string = "C"; 
  private isInitialized = false;
  
  // Track intended state to prevent race conditions
  private shouldBePlaying = false; 
  
  // FIX #3 & #4: Track fretboard mode to force synth-only playback
  private isFretboardMode = false;

  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null;
  public onStatusChange: ((text: string) => void) | null = null;

  public async init(vols: { groove: number, voice: number, click: number, master: number, drone: number }) {
    if (this.isInitialized) return;
    
    await Tone.start();

    // --- SETUP NODES ---
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);

    // Reverb Setup (Default to 0.3 mix)
    this.reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 }).connect(this.masterGain);
    this.reverb.wet.value = 0.3; 

    // Vocal Path (Voice -> Reverb -> Master)
    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb);

    // Drone Path (Drone -> Master) *Bypasses Reverb to stay clean*
    this.droneGain = new Tone.Gain(vols.drone).connect(this.masterGain);
    this.dronePlayer = new Tone.Player({ loop: true, fadeIn: 2, fadeOut: 2 }).connect(this.droneGain);

    // WARM INTIMATE PIANO SOUND
    this.trainingSynth = new Tone.Synth({
      oscillator: {
        type: "triangle"
      },
      envelope: {
        attack: 0.008,
        decay: 0.4,
        sustain: 0.2,
        release: 0.5
      },
      volume: 8
    });

    const pianoReverb = new Tone.Reverb({
      decay: 1.8,
      preDelay: 0.01,
      wet: 0.35
    });
    
    pianoReverb.generate();
    
    const trainingCompressor = new Tone.Compressor({
      threshold: -30,
      ratio: 6,
      attack: 0.008,
      release: 0.15,
      knee: 10
    });
    
    const makeupGain = new Tone.Gain(4);
    
    this.trainingGain = new Tone.Gain(this.trainingVol).connect(this.masterGain); 
    
    this.trainingSynth.connect(pianoReverb);
    pianoReverb.connect(trainingCompressor);
    trainingCompressor.connect(makeupGain);
    makeupGain.connect(this.trainingGain);

    this.transitionSynth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
      volume: -15
    }).connect(this.masterGain);

    this.metronome = new Metronome(this.masterGain);
    this.drumMachine = new DrumMachine(this.masterGain, this.reverb);
    
    this.scheduler = new Scheduler({
      onBeat: (b) => { if (this.onBeat) this.onBeat(b); },
      onTick: (t) => this.metronome.playTick(t),
      onNotePlay: (n, c) => { if (this.onNotePlay) this.onNotePlay(n, c); },
      playNoteAudio: (n, t, useSynth) => this.playMelodyNote(n, t, useSynth),
      onStart: (t) => this.playTransitionSound(t),
      onStatusChange: (text) => { if (this.onStatusChange) this.onStatusChange(text); }
    });

    this.drumMachine.setVolume(vols.groove);
    this.metronome.setClickVol(vols.click);
    this.isInitialized = true;
  }

  /**
   * FIX #3 & #4: Set fretboard mode flag
   * When true, ALWAYS uses synth (no vocal samples, no latency compensation)
   */
  public setFretboardMode(isFretboard: boolean) {
    this.isFretboardMode = isFretboard;
  }

  /**
   * ENHANCED: Play a melody note with hybrid vocal/synth system
   * FIX #3 & #4: In fretboard mode, ALWAYS use synth (no vocal samples)
   * This eliminates the mixed vocal/synth issue and timing problems
   */
  private playMelodyNote(note: NoteEvent, time: number, useSynth: boolean) {
    const midi = note.noteInfo.midi;
    const degree = note.noteInfo.degree;
    
    // FIX #3 & #4: Force synth in fretboard mode
    if (this.isFretboardMode) {
      const shortDuration = note.duration * 0.75;
      this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, shortDuration, time);
      return;
    }
    
    // HYBRID LOGIC for other modes: Check if we should use synth or vocal
    const isOutsideVocalRange = midi < MIN_VOCAL_MIDI || midi > MAX_VOCAL_MIDI;
    const shouldUseSynth = useSynth || isOutsideVocalRange;
    
    if (shouldUseSynth) {
      // Use synth for notes outside vocal range OR when explicitly requested
      const shortDuration = note.duration * 0.75;
      this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, shortDuration, time);
    } else {
      // Try to use vocal sample
      const id = `${degree}_${midi}`;
      const buffer = this.noteBuffers.get(id);
      
      if (buffer) {
        // Vocal sample available - use it
        const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
        source.start(Math.max(0, time), 0, buffer.duration);
      } else {
        // Sample missing - fall back to synth
        console.warn(`Sample not found for ${id}, falling back to synth`);
        const shortDuration = note.duration * 0.75;
        this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, shortDuration, time);
      }
    }
  }

  public setDrumPattern(name: string) { 
    if (this.isInitialized) {
      this.drumMachine.setPattern(name as any);
      if (this.shouldBePlaying && Tone.Transport.state === 'started') {
        this.drumMachine.sync();
      }
    }
  }

  public setReverbAmt(val: number) {
    if (this.isInitialized) this.reverb.wet.rampTo(val, 0.1);
  }

  public setBpm(bpm: number) { 
    if (this.isInitialized) this.scheduler.setBpm(bpm); 
  }

  public async loadBackingTracks(key: MusicalKey, _unused: string) {
    if (!this.isInitialized) return;
    this.currentTonic = typeof key === 'string' ? key : (key as any).tonic;
    
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const tonicLower = this.currentTonic.toLowerCase();
    const droneUrl = `${baseUrl}loops/drones/${tonicLower}_drone.mp3`;
    
    try {
      await this.dronePlayer.load(droneUrl);
      if (this.shouldBePlaying && Tone.Transport.state === 'started') {
        this.dronePlayer.start(0);
      }
    } catch (e) { console.error(`AudioEngine: Failed to load drone`, e); }
    
    if (this.shouldBePlaying) this.drumMachine.sync(); 
  }

  public scheduleRoutine(
    notes: NoteEvent[], 
    silent: boolean, 
    wheels: boolean, 
    isFirst: boolean, 
    onComplete: (nextStartTime: number) => void, 
    startTime?: number, 
    skipPrepare?: boolean,
    quizMode: boolean = false,
    fretboardMode: boolean = false // FIX #3: Add fretboardMode parameter
  ) {
    if (!this.isInitialized) return;
    const beatSec = 60 / Tone.Transport.bpm.value;
    const melodyDur = notes.reduce((sum, n) => sum + n.duration, 0) * beatSec; 
    
    let safeStartTime = startTime;
    const now = Tone.Transport.seconds;
    
    if (isFirst || safeStartTime === undefined || safeStartTime < now + 0.1) {
      if (isFirst && now < 0.1) {
        safeStartTime = 0; 
      } else {
        const beatLen = 60 / Tone.Transport.bpm.value;
        const measureLen = beatLen * 4;
        safeStartTime = Math.ceil(now / measureLen) * measureLen;
      }
    }

    this.scheduler.scheduleRoutine(
      notes, 
      silent, 
      wheels, 
      isFirst, 
      onComplete, 
      melodyDur, 
      safeStartTime, 
      skipPrepare,
      quizMode,
      fretboardMode // FIX #3: Pass fretboardMode to Scheduler
    );
  }

  public startPlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = true; 

    if (Tone.context.state !== 'running') Tone.context.resume();

    startKeepAlive();

    if (Tone.Transport.state !== 'started') {
      if (this.dronePlayer.loaded) this.dronePlayer.start(0);
      this.drumMachine.sync();
      this.scheduler.start();
    }
  }

  public stopAndKillBridge() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = false;
    stopKeepAlive();
    this.scheduler.stop(); 
    this.drumMachine.unsync();
    this.dronePlayer.stop(); 
    Tone.Transport.cancel();
  }

  public pausePlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = false;
    this.scheduler.pause();
    this.drumMachine.unsync();
    this.dronePlayer.stop();
  }

  public resumePlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = true;
    startKeepAlive();
    this.dronePlayer.start(0);
    this.drumMachine.sync();
    this.scheduler.resume();
  }

  public softReset() {
    if (!this.isInitialized) return;
    this.scheduler.stop(); 
    this.drumMachine.unsync();
    this.dronePlayer.stop(); 
    Tone.Transport.cancel();
  }

  // Volume setters
  public setDroneVol(v: number) { if (this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  public setDrumVol(v: number) { this.drumMachine?.setVolume(v); }
  public setVocalVol(v: number) { this.vocalGain?.gain.rampTo(v, 0.1); }
  public setMasterVol(v: number) { this.masterGain?.gain.rampTo(v, 0.1); }
  public setClickVol(v: number) { this.metronome?.setClickVol(v); }
  public setDebugClick(active: boolean) { this.metronome?.setDebugActive(active); }
  public setTrainingVol(v: number) { 
    this.trainingVol = v; 
    if (this.isInitialized && this.trainingGain) {
      const exponentialVol = Math.pow(v, 1.5);
      this.trainingGain.gain.rampTo(exponentialVol, 0.1); 
    }
  }
  
  /**
   * ENHANCED: Preload vocal samples for notes within vocal range
   * Notes outside the range will automatically use synth, so we don't try to load them
   */
  public async preloadNotes(notes: NoteEvent[]) {
    // FIX #3: Skip preloading in fretboard mode (synth-only)
    if (this.isFretboardMode) return;
    
    // Filter to only notes within vocal range
    const notesInVocalRange = notes.filter(
      n => n.noteInfo.midi >= MIN_VOCAL_MIDI && n.noteInfo.midi <= MAX_VOCAL_MIDI
    );
    
    const uniqueIds = Array.from(
      new Set(notesInVocalRange.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`))
    );
    
    const promises = uniqueIds.map(async (id) => {
      if (this.noteBuffers.has(id)) return;
      const degree = id.split('_')[0]; 
      const safeDegree = degree.replace('#', 's');
      const safeId = id.replace('#', 's');
      const url = `${import.meta.env.BASE_URL}samples/${safeDegree}/${safeId}.mp3`;
      try {
        const buffer = new Tone.ToneAudioBuffer();
        await buffer.load(url);
        this.noteBuffers.set(id, buffer); 
      } catch (e) { 
        // Don't warn - notes outside vocal range use synth automatically
      }
    });
    await Promise.all(promises);
  }

  private playTransitionSound(time: number) {
    const noteToPlay = `${this.currentTonic}3`;
    this.transitionSynth?.triggerAttackRelease(noteToPlay, "16n", time, 0.5);
  }
}

export const audioEngine = new AudioEngine();