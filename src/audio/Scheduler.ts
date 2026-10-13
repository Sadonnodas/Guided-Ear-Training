import * as Tone from "tone";
import type { NoteEvent } from "../types";
import { LATENCY_OFFSET } from "../config/AudioConfig";

type SchedulerCallbacks = {
  onBeat: (beat: number) => void;
  onTick: (time: number) => void;
  onNotePlay: (note: NoteEvent | null, isCountIn: boolean) => void;
  playNoteAudio: (note: NoteEvent, time: number, useSynth: boolean) => void;
  onStart: (time: number) => void;
  onStatusChange: (text: string) => void;
};

export class Scheduler {
  private melodyEventIds: number[] = [];
  private pulseEventId: number | null = null;
  private clickEventId: number | null = null;
  private callbacks: SchedulerCallbacks;

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks;
  }

  public setBpm(bpm: number) { Tone.getTransport().bpm.value = bpm; }

  public start() {
    if (Tone.getContext().state !== 'running') Tone.getContext().resume();
    if (Tone.getTransport().state !== 'started') {
      this.ensureSystemEvents();
      Tone.getTransport().start();
    }
  }

  public stop() {
    Tone.getTransport().stop();
    this.clearMelody();
    this.clearSystemEvents();
    Tone.getTransport().cancel(); 
  }

  public pause() {
    Tone.getTransport().pause();
  }

  public resume() {
    if (Tone.getContext().state !== 'running') Tone.getContext().resume();
    Tone.getTransport().start();
  }

  public scheduleRoutine(
      notes: NoteEvent[], 
      silentPractice: boolean, 
      trainingWheels: boolean, 
      _isFirst: boolean,
      onComplete: (nextStartTime: number) => void, 
      calculatedMelodyDur: number,
      atTime?: number,
      skipPrepare: boolean = false,
      inverseMode: boolean = false,
      fretboardMode: boolean = false // FIX #3: New parameter for fretboard mode
  ) {
    this.clearMelody();
    this.ensureSystemEvents();

    const beatSec = 60 / Tone.getTransport().bpm.value;
    const measureSec = 4 * beatSec;

    let anchorTime = atTime;
    if (anchorTime === undefined) {
        const now = Tone.getTransport().seconds;
        const nextQuarter = Math.ceil(now / beatSec) * beatSec;
        anchorTime = nextQuarter; 
    }

    const melodyStart = anchorTime + measureSec;

    const schedule = (callback: (time: number) => void, time: number) => {
        const id = Tone.getTransport().schedule(callback, time);
        this.melodyEventIds.push(id);
    };

    /**
     * Helper to schedule a pass
     * FIX #4: Remove latency offset for fretboard mode (synth-only, no vocal samples)
     */
    const schedulePass = (start: number, playAudio: boolean, isSilentPass: boolean, label: string) => {
        schedule((time) => {
            Tone.getDraw().schedule(() => {
                this.callbacks.onStatusChange(label);
            }, time);
        }, start);

        notes.forEach(note => {
            const noteTime = start + (note.startTime * beatSec);
            
            if (playAudio) {
                // FIX #4: No latency compensation in fretboard mode (synth-only)
                const offset = (fretboardMode || isSilentPass) ? 0 : (LATENCY_OFFSET[note.noteInfo.degree] || 0);
                const triggerTime = noteTime + offset;
                schedule((time) => this.callbacks.playNoteAudio(note, time, isSilentPass), triggerTime);
            }

            schedule((time) => {
                Tone.getDraw().schedule(() => {
                    if (!document.hidden) this.callbacks.onNotePlay(note, false);
                }, time);
            }, noteTime);
        });
    };

    let cursor = melodyStart;

    // FIX #3: Fretboard mode with different sequences based on hideFretboardVisuals
    if (fretboardMode) {
        // FRETBOARD MODE ALWAYS HAS 3 PASSES:
        // 1. Listen (synth plays)
        // 2. Play Along (synth plays, user tries to play along)
        // 3. Your Turn (user plays alone, optionally with training wheels)
        
        // Pass 1: Listen
        schedulePass(cursor, true, true, "Listen");  
        cursor += calculatedMelodyDur;
        
        // Pass 2: Play Along (synth plays, visualizer hidden if blind mode)
        schedulePass(cursor, true, true, "Play Along");  
        cursor += calculatedMelodyDur;
        
        // Pass 3: Your Turn (user plays alone, visualizer shown)
        schedulePass(cursor, trainingWheels, true, "Your Turn"); 
        cursor += calculatedMelodyDur;
    }
    else if (inverseMode) {
        // RANDOM/TRAINING INVERSE MODE: Synth -> Synth (Repeat) -> Vocal Answer -> Synth Affirmation
        schedulePass(cursor, true, true, "Listen");  
        cursor += calculatedMelodyDur;

        schedulePass(cursor, true, true, "Listen (Again)");  
        cursor += calculatedMelodyDur;

        schedulePass(cursor, true, false, "Answer");  
        cursor += calculatedMelodyDur;

        // Final pass: Synth again so the player can sing along with the correct pitch
        schedulePass(cursor, true, true, "Affirm");  
        cursor += calculatedMelodyDur;
    }
    else {
        // RANDOM/TRAINING NORMAL MODE: Listen -> Sing Along -> Your Turn (if enabled)
        schedulePass(cursor, true, false, "Listen");  
        cursor += calculatedMelodyDur;
        
        schedulePass(cursor, true, false, "Sing Along");  
        cursor += calculatedMelodyDur;
        
        if (silentPractice) {
            schedulePass(cursor, trainingWheels, true, "Your Turn"); 
            cursor += calculatedMelodyDur;
        }
    }

    // --- FIX: Schedule "Prepare" visual & Logic separately ---

    // 1. Visual Status Update: "Prepare..." (Skip if modulation is next)
    if (!skipPrepare) {
        schedule((time) => {
            Tone.getDraw().schedule(() => {
                this.callbacks.onStatusChange("Prepare...");
            }, time);
        }, cursor - 0.1);
    }

    // 2. Logic: Next Cycle Trigger
    // CRITICAL: NOT wrapped in Tone.getDraw(). This ensures the game continues even if the tab is hidden.
    schedule(() => {
        onComplete(cursor); 
    }, cursor - 0.05); 
  }

  /**
   * Schedule a key anchor: the key stated once, then taken away.
   *
   * Deliberately not a pass of scheduleRoutine. An anchor is heard once and
   * never repeated — repeating it would make it a melody to recognise rather
   * than a reference to remember, which is the whole point of practising
   * without the drone.
   */
  public scheduleAnchor(opts: {
    notes: NoteEvent[] | null;
    playChords: ((time: number, beatSec: number) => void) | null;
    beatsLong: number;
    label: string;
    onComplete: (nextStartTime: number) => void;
    atTime?: number;
  }) {
    this.clearMelody();
    this.ensureSystemEvents();

    const beatSec = 60 / Tone.getTransport().bpm.value;
    const measureSec = 4 * beatSec;

    let anchorTime = opts.atTime;
    if (anchorTime === undefined) {
      const now = Tone.getTransport().seconds;
      anchorTime = Math.ceil(now / beatSec) * beatSec;
    }
    const start = anchorTime + measureSec;

    const schedule = (callback: (time: number) => void, time: number) => {
      this.melodyEventIds.push(Tone.getTransport().schedule(callback, time));
    };

    schedule((time) => {
      Tone.getDraw().schedule(() => this.callbacks.onStatusChange(opts.label), time);
    }, start);

    if (opts.notes) {
      opts.notes.forEach((note) => {
        const noteTime = start + note.startTime * beatSec;
        // isSilentPass false: the vocals sing it, so the anchor arrives with
        // its degree names attached.
        schedule((time) => this.callbacks.playNoteAudio(note, time, false), noteTime);
        schedule((time) => {
          Tone.getDraw().schedule(() => {
            if (!document.hidden) this.callbacks.onNotePlay(note, false);
          }, time);
        }, noteTime);
      });
    }

    if (opts.playChords) {
      const playChords = opts.playChords;
      schedule((time) => playChords(time, beatSec), start);
    }

    const end = start + opts.beatsLong * beatSec;
    schedule(() => opts.onComplete(end), end - 0.05);
  }

  /**
   * One round of the sing-a-degree exercise: the key stated by chords (only
   * when it has just changed), a spoken "sing 7", a silence to sing into,
   * then that degree sung back at its real pitch.
   *
   * The spoken prompt is NOT scheduled through Draw. Draw discards callbacks
   * it reaches late, and a round whose prompt went missing is a round of
   * silence you cannot answer.
   */
  public scheduleDegreeRound(opts: {
    playChords: ((time: number, beatSec: number) => void) | null;
    chordBeats: number;
    promptBeats: number;
    silenceBeats: number;
    onPrompt: () => void;
    promptLabel: string;
    revealLabel: string;
    revealNote: NoteEvent;
    onReveal: () => void;
    onComplete: (nextStartTime: number) => void;
    atTime?: number;
  }) {
    this.clearMelody();
    this.ensureSystemEvents();

    const beatSec = 60 / Tone.getTransport().bpm.value;
    const measureSec = 4 * beatSec;

    let anchorTime = opts.atTime;
    if (anchorTime === undefined) {
      const now = Tone.getTransport().seconds;
      anchorTime = Math.ceil(now / beatSec) * beatSec;
    }
    const start = anchorTime + measureSec;

    const schedule = (callback: (time: number) => void, time: number) => {
      this.melodyEventIds.push(Tone.getTransport().schedule(callback, time));
    };
    const say = (label: string, at: number) => {
      schedule((time) => {
        Tone.getDraw().schedule(() => this.callbacks.onStatusChange(label), time);
      }, at);
    };

    let cursor = start;
    if (opts.playChords) {
      const playChords = opts.playChords;
      say("Listen", cursor);
      schedule((time) => playChords(time, beatSec), cursor);
      cursor += opts.chordBeats * beatSec;
    }

    say(opts.promptLabel, cursor);
    schedule(() => opts.onPrompt(), cursor);
    cursor += opts.promptBeats * beatSec;

    const revealAt = cursor + opts.silenceBeats * beatSec;
    say(opts.revealLabel, revealAt);
    schedule((time) => {
      this.callbacks.playNoteAudio(opts.revealNote, time, false);
      // State, not drawing — see the reveal in Find the Tonic.
      opts.onReveal();
      Tone.getDraw().schedule(() => {
        if (!document.hidden) this.callbacks.onNotePlay(opts.revealNote, false);
      }, time);
    }, revealAt);

    const end = revealAt + 6 * beatSec;
    schedule(() => opts.onComplete(end), end - 0.05);
  }

  private clearMelody() {
    this.melodyEventIds.forEach(id => Tone.getTransport().clear(id));
    this.melodyEventIds = [];
  }

  private ensureSystemEvents() {
    if (this.clickEventId !== null) return;

    this.pulseEventId = Tone.getTransport().scheduleRepeat((time) => {
        Tone.getDraw().schedule(() => {
             if (!document.hidden) {
                 this.callbacks.onBeat(Math.floor(Tone.getTransport().position as number));
             }
        }, time);
    }, "4n");

    this.clickEventId = Tone.getTransport().scheduleRepeat((time) => {
        this.callbacks.onTick(time);
    }, "4n");
  }

  private clearSystemEvents() {
    if (this.pulseEventId !== null) Tone.getTransport().clear(this.pulseEventId);
    if (this.clickEventId !== null) Tone.getTransport().clear(this.clickEventId);
    this.pulseEventId = null;
    this.clickEventId = null;
  }
}