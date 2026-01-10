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

  public setBpm(bpm: number) { Tone.Transport.bpm.value = bpm; }

  public start() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.Transport.state !== 'started') {
      this.ensureSystemEvents();
      Tone.Transport.start();
    }
  }

  public stop() {
    Tone.Transport.stop();
    this.clearMelody();
    this.clearSystemEvents();
    Tone.Transport.cancel(); 
  }

  public pause() {
    Tone.Transport.pause();
  }

  public resume() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    Tone.Transport.start();
  }

  public scheduleRoutine(
      notes: NoteEvent[], 
      silentPractice: boolean, 
      trainingWheels: boolean, 
      _isFirst: boolean,
      onComplete: (nextStartTime: number) => void, 
      calculatedMelodyDur: number,
      atTime?: number 
  ) {
    this.clearMelody();
    this.ensureSystemEvents();

    const beatSec = 60 / Tone.Transport.bpm.value;
    const measureSec = 4 * beatSec;

    let anchorTime = atTime;
    if (anchorTime === undefined) {
        const now = Tone.Transport.seconds;
        const nextQuarter = Math.ceil(now / beatSec) * beatSec;
        anchorTime = nextQuarter; 
    }

    const melodyStart = anchorTime + measureSec;

    const schedule = (callback: (time: number) => void, time: number) => {
        const id = Tone.Transport.schedule(callback, time);
        this.melodyEventIds.push(id);
    };

    /**
     * Helper to schedule a pass
     */
    const schedulePass = (start: number, playAudio: boolean, isSilentPass: boolean, label: string) => {
        schedule((time) => {
            Tone.Draw.schedule(() => {
                this.callbacks.onStatusChange(label);
            }, time);
        }, start);

        notes.forEach(note => {
            const noteTime = start + (note.startTime * beatSec);
            
            if (playAudio) {
                const offset = isSilentPass ? 0 : (LATENCY_OFFSET[note.noteInfo.degree] || 0);
                const triggerTime = noteTime + offset;
                schedule((time) => this.callbacks.playNoteAudio(note, time, isSilentPass), triggerTime);
            }

            schedule((time) => {
                Tone.Draw.schedule(() => {
                    if (!document.hidden) this.callbacks.onNotePlay(note, false);
                }, time);
            }, noteTime);
        });
    };

    let cursor = melodyStart;

    // Pass 1: Listen
    schedulePass(cursor, true, false, "Listen");  
    cursor += calculatedMelodyDur;
    
    // Pass 2: Sing Along
    schedulePass(cursor, true, false, "Sing Along");  
    cursor += calculatedMelodyDur;
    
    // Pass 3: Silent (Your Turn)
    if (silentPractice) {
        schedulePass(cursor, trainingWheels, true, "Your Turn"); 
        cursor += calculatedMelodyDur;
    }

    // --- FIX: Schedule "Prepare" visual & Logic separately ---

    // 1. Visual Status Update: "Prepare..."
    // Scheduled slightly before the end so it appears right as the user finishes singing.
    schedule((time) => {
        Tone.Draw.schedule(() => {
            this.callbacks.onStatusChange("Prepare...");
        }, time);
    }, cursor - 0.1);

    // 2. Logic: Next Cycle Trigger
    // CRITICAL: NOT wrapped in Tone.Draw. This ensures the game continues even if the tab is hidden.
    schedule(() => {
        onComplete(cursor); 
    }, cursor - 0.05); 
  }

  private clearMelody() {
    this.melodyEventIds.forEach(id => Tone.Transport.clear(id));
    this.melodyEventIds = [];
  }

  private ensureSystemEvents() {
    if (this.clickEventId !== null) return;

    this.pulseEventId = Tone.Transport.scheduleRepeat((time) => {
        Tone.Draw.schedule(() => {
             if (!document.hidden) {
                 this.callbacks.onBeat(Math.floor(Tone.Transport.position as number));
             }
        }, time);
    }, "4n");

    this.clickEventId = Tone.Transport.scheduleRepeat((time) => {
        this.callbacks.onTick(time);
    }, "4n");
  }

  private clearSystemEvents() {
    if (this.pulseEventId !== null) Tone.Transport.clear(this.pulseEventId);
    if (this.clickEventId !== null) Tone.Transport.clear(this.clickEventId);
    this.pulseEventId = null;
    this.clickEventId = null;
  }
}