console.log('🔄 AudioEngine loaded - Timing Version 3.0');

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
  // Makeup gain for the piano-replacement playback so piano samples sit at a
  // comparable loudness to the synth. The user-facing "Synth / Piano" fader
  // still rides on top of this (it drives trainingGain).
  private pianoPlaybackGain!: Tone.Gain;
  private transitionSynth!: Tone.MetalSynth;
  private metronome!: Metronome;
  private drumMachine!: DrumMachine;
  private scheduler!: Scheduler;
  private noteBuffers: Map<string, Tone.ToneAudioBuffer> = new Map();
  private bassBuffers: Map<number, Tone.ToneAudioBuffer> = new Map(); // NEW: Bass samples B_23 to B_67
  private pianoBuffers: Map<number, Tone.ToneAudioBuffer> = new Map(); // NEW: Piano samples P_23 to P_67
  
  // NEW: Separate gain nodes for bass and piano
  private bassGain!: Tone.Gain;
  private pianoGain!: Tone.Gain;
  
  // NEW: Timing offset adjustments (in seconds) - ADJUST THESE TO FIX TIMING
  // Use small values: -0.05 = 50ms earlier, 0.03 = 30ms later
  private readonly BASS_TIMING_OFFSET = -0.05;  // Positive = later, Negative = earlier
  private readonly PIANO_TIMING_OFFSET = -0.05; // Positive = later, Negative = earlier
  
  private currentTonic: string = "C"; 
  private isInitialized = false;
  
  // Track intended state to prevent race conditions
  private shouldBePlaying = false; 
  
  // FIX #3 & #4: Track fretboard mode to force synth-only playback
  private isFretboardMode = false;

  // Which instrument plays anywhere the synth would normally fire (fretboard
  // melodies, pitch guide, out-of-vocal-range fallback). Falls back to synth
  // automatically for notes outside the piano sample range (23-67).
  private playbackSound: 'synth' | 'piano' = 'synth';

  public onNotePlay: ((note: NoteEvent | null, isClick?: boolean) => void) | null = null;
  public onBeat: ((beatNumber: number) => void) | null = null;
  public onStatusChange: ((text: string) => void) | null = null;

  public async init(vols: { groove: number, voice: number, click: number, master: number, drone: number }) {
    if (this.isInitialized) return;
    
    console.log('🎛️ AudioEngine initializing with timing offsets:', {
      bass: this.BASS_TIMING_OFFSET,
      piano: this.PIANO_TIMING_OFFSET
    });
    
    await Tone.start();

    // --- SETUP NODES ---
    this.compressor = new Tone.Compressor({ threshold: -24, ratio: 6 }).toDestination();
    this.masterGain = new Tone.Gain(vols.master).connect(this.compressor);

    // Reverb Setup (Default to 0.3 mix)
    this.reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 }).connect(this.masterGain);
    this.reverb.wet.value = 0.3; 

    // Vocal Path (Voice -> Reverb -> Master)
    this.vocalGain = new Tone.Gain(vols.voice).connect(this.reverb);
    
    // NEW: Bass and Piano paths (for chord progressions)
    this.bassGain = new Tone.Gain(0.7).connect(this.reverb); // Default 0.7
    this.pianoGain = new Tone.Gain(0.6).connect(this.reverb); // Default 0.6

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

    // PERF: removed the dedicated piano-reverb on the synth chain — a second
    // Tone.Reverb (convolution) was running continuously alongside the master
    // reverb, ~10-15% sustained CPU on mobile for a subtle ambience that
    // hardly anyone notices. Compressor + makeup gain stay (both cheap) so
    // the synth keeps its loudness; it just sounds a touch drier.
    const trainingCompressor = new Tone.Compressor({
      threshold: -30,
      ratio: 6,
      attack: 0.008,
      release: 0.15,
      knee: 10
    });

    const makeupGain = new Tone.Gain(4);

    this.trainingGain = new Tone.Gain(this.trainingVol).connect(this.masterGain);

    // Piano-replacement playback routes through its own makeup gain (so piano
    // samples sit at roughly synth loudness) and then into trainingGain — the
    // "Synth / Piano" fader in the mixer rides on top of both.
    this.pianoPlaybackGain = new Tone.Gain(1.7).connect(this.trainingGain);

    this.trainingSynth.connect(trainingCompressor);
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
   * Choose which instrument replaces the synth in fretboard / pitch-guide /
   * fallback contexts. 'piano' uses the piano samples (MIDI 23-80, B0 to
   * G♯5 — covers the full CAGED fretboard range) and falls back to the
   * synth for any note outside that range.
   */
  public setPlaybackSound(sound: 'synth' | 'piano') {
    this.playbackSound = sound;
  }

  /**
   * Play a note via the "non-vocal" path — piano sample if the user picked
   * piano AND a sample exists for this MIDI, otherwise the training synth.
   * Routes through trainingGain so the existing "Guide" volume slider works.
   */
  private playSynthOrPiano(note: NoteEvent, time: number) {
    if (this.playbackSound === 'piano') {
      const pianoBuffer = this.pianoBuffers.get(note.noteInfo.midi);
      if (pianoBuffer) {
        const source = new Tone.ToneBufferSource(pianoBuffer).connect(this.pianoPlaybackGain);
        source.start(Math.max(0, time));
        return;
      }
      // No piano sample (e.g. note above the highest sample) — fall through.
    }
    const shortDuration = note.duration * 0.75;
    this.trainingSynth.triggerAttackRelease(note.noteInfo.frequency, shortDuration, time);
  }

  /**
   * ENHANCED: Play a melody note with hybrid vocal/synth system
   * FIX #3 & #4: In fretboard mode, ALWAYS use synth (no vocal samples)
   * This eliminates the mixed vocal/synth issue and timing problems
   */
  private playMelodyNote(note: NoteEvent, time: number, useSynth: boolean) {
    const midi = note.noteInfo.midi;
    const degree = note.noteInfo.degree;

    // Fretboard mode: never uses vocal samples — always synth or piano.
    if (this.isFretboardMode) {
      this.playSynthOrPiano(note, time);
      return;
    }

    // Hybrid logic for other modes: prefer vocal samples, fall back otherwise.
    const isOutsideVocalRange = midi < MIN_VOCAL_MIDI || midi > MAX_VOCAL_MIDI;
    const shouldUseSynth = useSynth || isOutsideVocalRange;

    if (shouldUseSynth) {
      this.playSynthOrPiano(note, time);
    } else {
      const id = `${degree}_${midi}`;
      const buffer = this.noteBuffers.get(id);
      if (buffer) {
        const source = new Tone.ToneBufferSource(buffer).connect(this.vocalGain);
        source.start(Math.max(0, time), 0, buffer.duration);
      } else {
        console.warn(`Sample not found for ${id}, falling back to synth/piano`);
        this.playSynthOrPiano(note, time);
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
    const beatLen = 60 / Tone.Transport.bpm.value;
    const measureLen = beatLen * 4;

    // Re-anchor when:
    //   - first cycle, or no startTime provided
    //   - startTime is in the past (preload took longer than the small lead)
    //   - startTime is unreasonably far in the future (Tone.Transport.seconds
    //     rescales when bpm changes mid-session, which can leave a startTime
    //     from the previous bpm sitting several seconds ahead of "now" and
    //     causing a long silent gap before the next cycle plays).
    const tooFarAhead = safeStartTime !== undefined && safeStartTime > now + measureLen * 1.5;
    if (isFirst || safeStartTime === undefined || safeStartTime < now + 0.1 || tooFarAhead) {
      if (isFirst && now < 0.1) {
        safeStartTime = 0;
      } else {
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
    // When the user picked piano playback we also need the piano samples for
    // every melody note (including in fretboard mode, where vocals don't play).
    const pianoLoad = this.playbackSound === 'piano'
      ? this.loadPianoBuffers(notes.map(n => n.noteInfo.midi))
      : Promise.resolve();

    // Fretboard mode doesn't use vocal samples — only the piano preload above.
    if (this.isFretboardMode) {
      await pianoLoad;
      return;
    }

    // Filter to only notes within vocal range
    const notesInVocalRange = notes.filter(
      n => n.noteInfo.midi >= MIN_VOCAL_MIDI && n.noteInfo.midi <= MAX_VOCAL_MIDI
    );

    const uniqueIds = Array.from(
      new Set(notesInVocalRange.map(n => `${n.noteInfo.degree}_${n.noteInfo.midi}`))
    );

    const vocalLoad = Promise.all(uniqueIds.map(async (id) => {
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
        // Don't warn - notes outside vocal range use synth/piano automatically
      }
    }));

    await Promise.all([vocalLoad, pianoLoad]);
  }

  /**
   * Load piano samples for the given MIDI notes (within the piano sample
   * range 23-80, B0 to G♯5 — covers progressions, vocals, and the full
   * CAGED fretboard range). Used by both chord-progression playback and
   * the melody/fretboard piano-playback option.
   */
  private async loadPianoBuffers(midis: number[]) {
    const unique = Array.from(new Set(midis.filter(m => m >= 23 && m <= 80)));
    await Promise.all(unique.map(async (midi) => {
      if (this.pianoBuffers.has(midi)) return;
      const pianoUrl = `${import.meta.env.BASE_URL}samples/piano/P_${midi}.mp3`;
      try {
        const buffer = new Tone.ToneAudioBuffer();
        await buffer.load(pianoUrl);
        this.pianoBuffers.set(midi, buffer);
      } catch (e) {
        // Missing piano sample — playback will fall back to the synth.
      }
    }));
  }

  /**
   * NEW: Preload bass and piano samples for chord progressions
   * Range: MIDI 23 to 67 for both instruments
   */
  public async preloadChordSamples(midiNotes: number[]) {
    const uniqueMidi = Array.from(new Set(midiNotes));
    
    const promises = uniqueMidi.map(async (midi) => {
      // Load bass sample if not already loaded
      if (!this.bassBuffers.has(midi)) {
        const bassUrl = `${import.meta.env.BASE_URL}samples/bass/B_${midi}.mp3`;
        try {
          const buffer = new Tone.ToneAudioBuffer();
          await buffer.load(bassUrl);
          this.bassBuffers.set(midi, buffer);
        } catch (e) {
          console.warn(`Failed to load bass sample B_${midi}.mp3`);
        }
      }
      
      // Load piano sample if not already loaded
      if (!this.pianoBuffers.has(midi)) {
        const pianoUrl = `${import.meta.env.BASE_URL}samples/piano/P_${midi}.mp3`;
        try {
          const buffer = new Tone.ToneAudioBuffer();
          await buffer.load(pianoUrl);
          this.pianoBuffers.set(midi, buffer);
        } catch (e) {
          console.warn(`Failed to load piano sample P_${midi}.mp3`);
        }
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * NEW: Play a chord (bass + triad) using loaded samples
   * Uses BASS_TIMING_OFFSET and PIANO_TIMING_OFFSET for timing adjustments
   */
  public playChord(bassNote: number, triadNotes: number[], time: number) {
    if (!this.isInitialized) return;

    // PERF: dropped per-chord diagnostic logs — they fired 4-5 times per chord,
    // which on mobile cost real CPU (string formatting + devtools serialization)
    // every progression cycle. Warnings on missing samples remain below.

    // Play bass note with timing offset
    const bassBuffer = this.bassBuffers.get(bassNote);
    if (bassBuffer) {
      const bassSource = new Tone.ToneBufferSource(bassBuffer).connect(this.bassGain);
      const bassTime = time + this.BASS_TIMING_OFFSET;
      bassSource.start(bassTime);
    } else {
      console.warn(`Bass sample not found for MIDI ${bassNote}`);
    }

    // Play triad notes with timing offset
    triadNotes.forEach((midi) => {
      const pianoBuffer = this.pianoBuffers.get(midi);
      if (pianoBuffer) {
        const pianoSource = new Tone.ToneBufferSource(pianoBuffer).connect(this.pianoGain);
        const pianoTime = time + this.PIANO_TIMING_OFFSET;
        pianoSource.start(pianoTime);
      } else {
        console.warn(`Piano sample not found for MIDI ${midi}`);
      }
    });
  }
  
  // NEW: Volume control methods
  public setBassVolume(vol: number) {
    if (this.bassGain) this.bassGain.gain.rampTo(vol, 0.1);
  }
  
  public setPianoVolume(vol: number) {
    if (this.pianoGain) this.pianoGain.gain.rampTo(vol, 0.1);
  }

  private playTransitionSound(time: number) {
    const noteToPlay = `${this.currentTonic}3`;
    this.transitionSynth?.triggerAttackRelease(noteToPlay, "16n", time, 0.5);
  }
}

export const audioEngine = new AudioEngine();