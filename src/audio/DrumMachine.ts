import * as Tone from "tone";
import { DRUM_OFFSETS, DRUM_PATTERNS } from "../config/AudioConfig";

export class DrumMachine {
  private players: Tone.Players;
  // CHANGE: Default to "Lofi Chill"
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
          // Handle cases where beatInfo might be complex later, but assuming number for now
          const beatNum = typeof beatInfo === 'number' ? beatInfo : 0;
          
          // Convert decimal beats (0, 0.5, 1) into "0:0:0" format
          // beatNum is in Quarter Notes.
          // 0.25 = 1 sixteenth note
          const quarters = Math.floor(beatNum);
          const sixteenths = (beatNum % 1) * 4;
          const timeString = `0:${quarters}:${sixteenths}`;

          // Apply offset (converting seconds to Tone time is tricky in scheduleRepeat, 
          // so we add it inside the callback)
          const offset = DRUM_OFFSETS[instrument] || 0;
          
          const id = Tone.Transport.scheduleRepeat((time) => {
            this.players.player(instrument).start(time + offset);
          }, "1m", timeString); // Repeat every 1m, starting at timeString
          
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