import * as Tone from "tone";
import { DRUM_OFFSETS, DRUM_PATTERNS } from "../config/AudioConfig";

/**
 * INDIVIDUAL SAMPLE GAINS (in Decibels)
 * Adjust these values to mix the kit. 
 * Negative values reduce volume, positive values increase it.
 * 0 is the default volume.
 */
const SAMPLE_GAINS: Record<string, number> = {
  // Elements that often need taming
  hihat: -6,          
  hihat_open: -4,
  hihat_vinyl: -2,
  shaker: -3,
  tambourine: -6,
  crash: -4,
  ride: -3,
  
  // Core elements
  kick: 0,
  kick_soft: 0,
  snare: 0,
  rimshot: -1,
  clap: -1,
  snap: -1,
  
  // Percussion
  clave: -2,
  woodblock: -2,
  triangle: -4,
  
  // Toms (NEW)
  racktom: -2,
  floortom: -2
};

export class DrumMachine {
  private players: Tone.Players;
  private currentPatternName: keyof typeof DRUM_PATTERNS = "Lofi Chill";
  private scheduledEvents: number[] = [];

  constructor(destination: Tone.ToneAudioNode) {
    this.players = new Tone.Players({
      urls: {
        clap:         "clap.mp3",
        clave:        "clave.mp3",
        crash:        "crash.mp3",
        cymbal:       "cymbal.mp3",
        floortom:     "floortom.mp3",
        hihat:        "hihat.mp3",
        hihat_foot:   "hats_foot.mp3",
        hihat_open:   "hats_open.mp3",
        hihat_vinyl:  "hats_vinyl_edge.mp3",
        kick:         "kick_goat.mp3",
        kick_soft:    "kick_soft.mp3",
        racktom:      "racktom.mp3",
        ride:         "ride.mp3",
        rimshot:      "rimshot.mp3",
        shaker:       "shaker.mp3",
        snap:         "snap.mp3",
        snare:        "snare.mp3",
        stick:        "stick.mp3",
        tambourine:   "tambourine.mp3",
        triangle:     "triangle.mp3",
        woodblock:    "woodblock.mp3"
      },
      baseUrl: `${import.meta.env.BASE_URL}samples/drums/`,
      fadeOut: "64n"
    }).connect(destination);

    // APPLY INDIVIDUAL GAINS
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
    if (Tone.Transport.state === "started") {
      this.sync();
    }
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