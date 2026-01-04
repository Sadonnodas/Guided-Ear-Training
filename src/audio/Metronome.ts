import * as Tone from "tone";

export class Metronome {
  private clickGain: Tone.Gain;
  private debugClickGain: Tone.Gain;
  private clickSynth: Tone.Synth;
  private debugClickSynth: Tone.MembraneSynth;

  private isDebugActive = false;
  private debugVol = 0.5;

  // FIX: Changed Tone.AudioNode to Tone.ToneAudioNode
  constructor(destination: Tone.ToneAudioNode) {
    this.clickGain = new Tone.Gain(0).connect(destination);
    this.debugClickGain = new Tone.Gain(0).connect(destination);

    this.clickSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.clickGain);

    this.debugClickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.debugClickGain);
  }

  setClickVol(v: number) {
    this.clickGain.gain.rampTo(v, 0.1);
  }

  setDebugVol(v: number) {
    this.debugVol = v;
    this.updateDebugGain();
  }

  setDebugActive(active: boolean) {
    this.isDebugActive = active;
    this.updateDebugGain();
  }

  private updateDebugGain() {
    const target = this.isDebugActive ? this.debugVol : 0;
    this.debugClickGain.gain.rampTo(target, 0.1);
  }

  // Called by Scheduler on every beat
  playTick(time: number) {
    if (this.isDebugActive) {
      this.debugClickSynth.triggerAttackRelease("C5", "32n", time);
    }
  }

  // Called manually for rhythm patterns if needed
  playClickNote(time: number) {
    this.clickSynth.triggerAttackRelease("C5", "32n", time);
  }
}