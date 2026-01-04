import * as Tone from "tone";
import type { NoteEvent } from "../types";
import { LATENCY_OFFSET } from "../config/AudioConfig";

type SchedulerCallbacks = {
  onBeat: (beat: number) => void;
  onTick: (time: number) => void;
  onNotePlay: (note: NoteEvent | null, isCountIn: boolean) => void;
  playNoteAudio: (note: NoteEvent, time: number) => void;
  onStart: (time: number) => void;
};

export class Scheduler {
  private melodyEventIds: number[] = [];
  private pulseEventId: number | null = null;
  private clickEventId: number | null = null;
  
  private callbacks: SchedulerCallbacks;

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks;
  }

  start() {
    // Ensure Context is running (fixes potential suspend issues on mobile/tab switch)
    if (Tone.context.state !== 'running') {
        Tone.context.resume();
    }

    if (Tone.Transport.state !== 'started') {
      Tone.Transport.position = 0;
      this.ensureSystemEvents();
      Tone.Transport.start();
    }
  }

  pause() {
    Tone.Transport.pause();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    
    // FIX: Clear any pending visual events so they don't get stuck
    Tone.Draw.cancel(0);

    this.clearMelody();
    this.clearSystemEvents();
    Tone.Transport.cancel();
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  scheduleRoutine(
      notes: NoteEvent[], 
      silentPractice: boolean, 
      _isFirstQuestion: boolean, 
      onComplete: () => void,
      calculatedMelodyDur: number 
  ): number {
    this.stop(); // Ensure clean slate (includes Draw.cancel)
    this.ensureSystemEvents();

    const beatSec = 60 / Tone.Transport.bpm.value;
    const measureSec = 4 * beatSec;

    // Start melody after 1 measure of count-in
    const startPoint = measureSec; 

    const schedule = (callback: (time: number) => void, time: number) => {
        const id = Tone.Transport.schedule(callback, time);
        this.melodyEventIds.push(id);
    };

    // 1. Count In (Visuals)
    for (let i = 0; i < 4; i++) {
        const offsetBeats = 4 - i;
        const t = startPoint - (offsetBeats * beatSec);
        schedule((time) => {
             // FIX: Only draw if document is visible to prevent queue clogging
             Tone.Draw.schedule(() => {
                 if (!document.hidden) this.callbacks.onNotePlay(null, true);
             }, time);
        }, t);
    }

    // 2. Melody Passes
    const schedulePass = (start: number, playAudio: boolean) => {
        notes.forEach(note => {
            const degree = note.noteInfo.degree;
            const offset = LATENCY_OFFSET[degree] || 0;
            const beatTime = start + (note.startTime * beatSec);
            const triggerTime = beatTime + offset;

            if (playAudio) {
                schedule((time) => this.callbacks.playNoteAudio(note, time), triggerTime);
            }

            schedule((time) => {
                Tone.Draw.schedule(() => {
                    if (!document.hidden) this.callbacks.onNotePlay(note, false);
                }, time);
            }, beatTime);
        });
    };

    let cursor = startPoint;
    schedulePass(cursor, true); // Pass 1
    cursor += calculatedMelodyDur;
    
    schedulePass(cursor, true); // Pass 2
    cursor += calculatedMelodyDur;
    
    if (silentPractice) {
        schedulePass(cursor, false); // Pass 3
        cursor += calculatedMelodyDur;
    }

    // --- CHIME AT END OF LOOP (PICKUP) ---
    const chimeOffset = 0.01; 
    const chimeTime = Math.max(0, cursor - chimeOffset); // Prevent negative time

    if (chimeTime > 0) {
        schedule((time) => {
            this.callbacks.onStart(time);
        }, chimeTime);
    }

    // --- LOOP TRIGGER ---
    // FIX: Schedule onComplete slightly BEFORE the absolute end (e.g., 50ms).
    // This ensures it fires reliably before the Transport stops/loops.
    // Also removes dependence on setTimeout which is unreliable in background tabs.
    schedule(() => {
        onComplete();
    }, Math.max(0, cursor - 0.05)); 

    return cursor;
  }

  private clearMelody() {
    this.melodyEventIds.forEach(id => Tone.Transport.clear(id));
    this.melodyEventIds = [];
  }

  private clearSystemEvents() {
    if (this.pulseEventId !== null) Tone.Transport.clear(this.pulseEventId);
    if (this.clickEventId !== null) Tone.Transport.clear(this.clickEventId);
    this.pulseEventId = null;
    this.clickEventId = null;
  }

  private ensureSystemEvents() {
    this.clearSystemEvents();

    // Pulse (Visual)
    this.pulseEventId = Tone.Transport.scheduleRepeat((time) => {
        Tone.Draw.schedule(() => {
             if (!document.hidden) {
                 this.callbacks.onBeat(Math.floor(Tone.Transport.position as number));
             }
        }, time);
    }, "4n");

    // Metronome (Audio) - Visual check not needed for audio
    this.clickEventId = Tone.Transport.scheduleRepeat((time) => {
        this.callbacks.onTick(time);
    }, "4n");
  }
}