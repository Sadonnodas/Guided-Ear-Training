import * as Tone from "tone";
import { DRUM_OFFSETS, DRUM_PATTERNS } from "../config/AudioConfig";

// ... (Keep SAMPLE_GAINS the same) ...
const SAMPLE_GAINS: Record<string, number> = {
  hihat: -6, hihat_open: -4, hihat_vinyl: -2, shaker: -3, tambourine: -8, crash: -4, ride: -3,
  kick: 0, kick_soft: 0, snare: 0, rimshot: -1, clap: -1, snap: -10,
  clave: -4, woodblock: -2, triangle: -4, racktom: -2, floortom: -2
};

export class DrumMachine {
  private players: Tone.Players;
  private currentPatternName: keyof typeof DRUM_PATTERNS = "Lofi Chill";
  private scheduledEvents: number[] = [];
  
  // NEW: Internal Send Channel
  private reverbSend: Tone.Gain; 

  constructor(destination: Tone.ToneAudioNode, reverbNode: Tone.Reverb) {
    
    // 1. Create a send channel
    this.reverbSend = new Tone.Gain(0.25).connect(reverbNode); // Adjust 0.25 for how wet you want the drums

    this.players = new Tone.Players({
      urls: {
        clap: "clap.mp3", clave: "clave.mp3", crash: "crash.mp3", cymbal: "cymbal.mp3",
        floortom: "floortom.mp3", hihat: "hihat.mp3", hihat_foot: "hats_foot.mp3",
        hihat_open: "hats_open.mp3", hihat_vinyl: "hats_vinyl_edge.mp3", kick: "kick_goat.mp3",
        kick_soft: "kick_soft.mp3", racktom: "racktom.mp3", ride: "ride.mp3",
        rimshot: "rimshot.mp3", shaker: "shaker.mp3", snap: "snap.mp3", snare: "snare.mp3",
        stick: "stick.mp3", tambourine: "tambourine.mp3", triangle: "triangle.mp3",
        woodblock: "woodblock.mp3"
      },
      baseUrl: `${import.meta.env.BASE_URL}samples/drums/`,
      fadeOut: "64n"
    });

    // 2. Route all drums to Main Destination (Dry)
    this.players.connect(destination);

    // 3. Selectively Route Snare/Claps to Reverb (Wet)
    if (this.players.has("snare")) this.players.player("snare").connect(this.reverbSend);
    if (this.players.has("clap")) this.players.player("clap").connect(this.reverbSend);
    if (this.players.has("snap")) this.players.player("snap").connect(this.reverbSend);
    if (this.players.has("rimshot")) this.players.player("rimshot").connect(this.reverbSend);

    Object.entries(SAMPLE_GAINS).forEach(([name, db]) => {
      if (this.players.has(name)) {
        this.players.player(name).volume.value = db;
      }
    });
  }

  public setVolume(v: number) {
    this.players.volume.rampTo(Tone.gainToDb(v), 0.1);
  }

  public setPattern(name: keyof typeof DRUM_PATTERNS) {
    this.currentPatternName = name;
  }

  public sync() {
    this.unsync();
    const pattern = DRUM_PATTERNS[this.currentPatternName];

    Object.entries(pattern).forEach(([instrument, beats]) => {
      if (this.players.has(instrument)) {
        beats.forEach(beatInfo => {
          const beatNum = typeof beatInfo === 'number' ? beatInfo : 0;
          const quarters = Math.floor(beatNum);
          const sixteenths = (beatNum % 1) * 4;
          const timeString = `0:${quarters}:${sixteenths}`;
          const offset = DRUM_OFFSETS[instrument] || 0;
          
          const id = Tone.Transport.scheduleRepeat((time) => {
            this.players.player(instrument).start(time + offset);
          }, "1m", timeString); 
          
          this.scheduledEvents.push(id as number);
        });
      }
    });
  }

  public unsync() {
    this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
    this.scheduledEvents = [];
  }
}