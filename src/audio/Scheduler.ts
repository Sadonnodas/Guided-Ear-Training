import * as Tone from "tone";
import type { NoteEvent } from "../types";
import { LATENCY_OFFSET } from "../config/AudioConfig";

type SchedulerCallbacks = {
  onBeat: (beat: number) => void;
  onTick: (time: number) => void;
  onNotePlay: (note: NoteEvent | null, isCountIn: boolean) => void;
  playNoteAudio: (note: NoteEvent, time: number) => void;
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
    this.clearMelody();
    this.clearSystemEvents();
    Tone.Transport.cancel();
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  // UPDATED: Now accepts 'calculatedMelodyDur'
  scheduleRoutine(
      notes: NoteEvent[], 
      silentPractice: boolean, 
      isFirstQuestion: boolean, 
      onComplete: () => void,
      calculatedMelodyDur: number // NEW PARAMETER
  ): number {
    this.clearMelody();
    
    if (this.pulseEventId === null && Tone.Transport.state === 'started') {
        this.ensureSystemEvents();
    }

    const beatSec = 60 / Tone.Transport.bpm.value;
    const measureSec = 4 * beatSec;

    // --- GRID ALIGNMENT ---
    let startPoint = 0;
    if (Tone.Transport.state === 'started') {
        const currentTime = Tone.Transport.seconds;
        const nextGridBoundary = Math.ceil(currentTime / measureSec) * measureSec;
        const bufferNeeded = 0.5;
        
        startPoint = (nextGridBoundary - currentTime < bufferNeeded) 
          ? nextGridBoundary + measureSec 
          : nextGridBoundary;
    } else {
        startPoint = measureSec;
    }

    if (isFirstQuestion && startPoint < measureSec) {
        startPoint = measureSec;
    }

    const schedule = (callback: (time: number) => void, time: number) => {
        if (time >= Tone.Transport.seconds - 0.1) {
             const id = Tone.Transport.schedule(callback, time);
             this.melodyEventIds.push(id);
        }
    };

    // 1. Count In
    for (let i = 0; i < 4; i++) {
        const offsetBeats = 4 - i;
        const t = startPoint - (offsetBeats * beatSec);
        schedule((time) => {
             Tone.Draw.schedule(() => this.callbacks.onNotePlay(null, true), time);
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
                Tone.Draw.schedule(() => this.callbacks.onNotePlay(note, false), time);
            }, beatTime);
        });
    };

    let cursor = startPoint;
    schedulePass(cursor, true); // Pass 1
    cursor += calculatedMelodyDur; // USE CALCULATED DURATION
    
    schedulePass(cursor, true); // Pass 2
    cursor += calculatedMelodyDur;
    
    if (silentPractice) {
        schedulePass(cursor, false); // Pass 3
        cursor += calculatedMelodyDur;
    }

    schedule(() => setTimeout(() => onComplete(), 0), cursor);
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
             this.callbacks.onBeat(Math.floor(Tone.Transport.position as number));
        }, time);
    }, "4n");

    // Metronome (Audio)
    this.clickEventId = Tone.Transport.scheduleRepeat((time) => {
        this.callbacks.onTick(time);
    }, "4n");
  }
}