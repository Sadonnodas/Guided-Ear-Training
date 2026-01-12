import * as Tone from "tone";
import type { NoteEvent, MusicalKey } from "../types";
import { Metronome } from "./Metronome";
import { DrumMachine } from "./DrumMachine";
import { Scheduler } from "./Scheduler";
import { startKeepAlive, stopKeepAlive } from "./KeepAlive";

export class AudioEngine {
  private masterGain!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private reverb!: Tone.Reverb;
  private vocalGain!: Tone.Gain;
  private droneGain!: Tone.Gain;
  private dronePlayer!: Tone.Player;
  private trainingSynth!: Tone.FMSynth; // Changed to FMSynth for Rhodes sound
  private trainingGain!: Tone.Gain;
  private trainingVol: number = 0.3;
  private transitionSynth!: Tone.MetalSynth;
  private metronome!: Metronome;
  private drumMachine!: DrumMachine;
  private scheduler!: Scheduler;
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  private currentTonic: string = "C"; 
  private isInitialized = false;
  
  // NEW: Track intended state to prevent race conditions
  private shouldBePlaying = false; 

  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null;
  public onStatusChange: ((text: string) => void) | null = null;

  public async init(vols: { groove: number, voice: number, click: number, master: number, drone: number }) {
    if (this.isInitialized) return;
    
    // We remove initKeepAlive() from here. 
    // It is now handled by the useEffect in useSessionLogic.ts
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

   // FMSynth creates the "tine" and "bell" quality of a Rhodes
   this.trainingSynth = new Tone.FMSynth({
        harmonicity: 2, // Creates a more musical, bell-like harmonic structure
        modulationIndex: 15, // Higher index adds "bark" to cut through the drone
        oscillator: { type: "sine" }, 
        modulation: { type: "sawtooth" }, // Sawtooth adds the grit needed for low-note visibility
        envelope: {
            attack: 0.005, // Snappier attack for better definition
            decay: 0.5,
            sustain: 0.3, // SIGNIFICANTLY increased sustain so notes ring out
            release: 0.5
        },
        modulationEnvelope: {
            attack: 0.01,
            decay: 0.5,
            sustain: 0.6,
            release: 1.0
        }
    // The first number (3) is speed in Hz, the second (0.05) is the pitch depth.
    }).connect(new Tone.Vibrato(3, 0.05).toDestination());

    // Start with the volume passed in from the UI/vols
    this.trainingGain = new Tone.Gain(this.trainingVol).connect(this.masterGain); 
    this.trainingSynth.connect(this.trainingGain);

    this.transitionSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
        volume: -15
    }).connect(this.masterGain);

    this.metronome = new Metronome(this.masterGain);
    
    // PASS REVERB TO DRUMS
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

  // ... (keep playMelodyNote same) ...
  private playMelodyNote(note: NoteEvent, time: number, useSynth: boolean) {
    if (useSynth) {
        // Multiply duration by 0.4 to make the note play for only 40% of its length
        const shortDuration = note.duration * 0.8; 
        this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, shortDuration, time);
    } else {
        const degree = note.noteInfo.degree;
        const id = `${degree}_${note.noteInfo.midi}`;
        const buffer = this.noteBuffers.get(id);
        if (buffer) {
            const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
            source.start(Math.max(0, time), 0, buffer.duration);
        }
    }
  }

  public setDrumPattern(name: string) { 
      // BUG FIX: Only sync if we actually want to be playing
      if (this.isInitialized) {
          this.drumMachine.setPattern(name as any);
          if (this.shouldBePlaying && Tone.Transport.state === 'started') {
              this.drumMachine.sync();
          }
      }
  }

  // NEW: Reverb Control
  public setReverbAmt(val: number) {
      if (this.isInitialized) this.reverb.wet.rampTo(val, 0.1);
  }

  public setBpm(bpm: number) { if (this.isInitialized) this.scheduler.setBpm(bpm); }

  public async loadBackingTracks(key: MusicalKey, _unused: string) {
    if (!this.isInitialized) return;
    this.currentTonic = typeof key === 'string' ? key : (key as any).tonic;
    
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const tonicLower = this.currentTonic.toLowerCase();
    const droneUrl = `${baseUrl}loops/drones/${tonicLower}_drone.mp3`;
    
    try {
        await this.dronePlayer.load(droneUrl);
        // BUG FIX: Only restart drone if we are supposed to be playing
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
    quizMode: boolean = false // Added 8th parameter
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

      // Pass the 8th argument (quizMode) to the scheduler
      this.scheduler.scheduleRoutine(
        notes, 
        silent, 
        wheels, 
        isFirst, 
        onComplete, 
        melodyDur, 
        safeStartTime, 
        skipPrepare,
        quizMode
      );
    }

  public startPlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = true; 

    if (Tone.context.state !== 'running') Tone.context.resume();

    // Fire and forget the bridge so it doesn't block the music
    startKeepAlive();

    if (Tone.Transport.state !== 'started') {
        if (this.dronePlayer.loaded) this.dronePlayer.start(0);
        this.drumMachine.sync();
        this.scheduler.start();
    }
  }

  // NEW: Use this ONLY for the physical STOP button in the UI
  // Use this for the physical STOP button in the UI
  public stopAndKillBridge() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = false;
    stopKeepAlive(); // This allows the system to sleep
    this.scheduler.stop(); 
    this.drumMachine.unsync();
    this.dronePlayer.stop(); 
    Tone.Transport.cancel();
  }

  public pausePlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = false;
    this.scheduler.pause();
    this.drumMachine.unsync(); // Stop drums, but keep melody events
    this.dronePlayer.stop();
  }

  public resumePlayback() {
    if (!this.isInitialized) return;
    this.shouldBePlaying = true;
    startKeepAlive(); // Re-engage background audio
    this.dronePlayer.start(0);
    this.drumMachine.sync();
    this.scheduler.resume();
  }

  // Use this for internal changes like Key or Scale changes
  public softReset() {
    if (!this.isInitialized) return;
    this.scheduler.stop(); 
    this.drumMachine.unsync();
    this.dronePlayer.stop(); 
    // DO NOT call stopKeepAlive() here; this keeps the pocket mode alive
    Tone.Transport.cancel();
  }

  // Vol setters...
  public setDroneVol(v: number) { if (this.isInitialized) this.droneGain.gain.rampTo(v, 0.1); }
  public setDrumVol(v: number) { this.drumMachine?.setVolume(v); }
  public setVocalVol(v: number) { this.vocalGain?.gain.rampTo(v, 0.1); }
  public setMasterVol(v: number) { this.masterGain?.gain.rampTo(v, 0.1); }
  public setClickVol(v: number) { this.metronome?.setClickVol(v); }
  public setDebugClick(active: boolean) { this.metronome?.setDebugActive(active); }
  // This will make the slider's 0-1 range feel like 0-0.5
  public setTrainingVol(v: number) { 
    this.trainingVol = v; 
    // This physically updates the Gain node in real-time
    if (this.isInitialized && this.trainingGain) {
        this.trainingGain.gain.rampTo(v, 0.1); 
    }
  }
  
  // ... (keep preloadNotes and transitionSound same) ...
  public async preloadNotes(notes: NoteEvent[]) {
      // (Keep existing code)
      const uniqueIds = Array.from(new Set(notes.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`)));
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
        } catch (e) { console.warn("Sample load failed:", url); }
      });
      await Promise.all(promises);
  }

  private playTransitionSound(time: number) {
      const noteToPlay = `${this.currentTonic}3`;
      this.transitionSynth?.triggerAttackRelease(noteToPlay, "16n", time, 0.5);
  }
}
export const audioEngine = new AudioEngine();