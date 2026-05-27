/**
 * Build the full list of audio asset URLs the app might fetch at runtime —
 * vocals, bass, piano, drum samples, drum loops, and tonic drones. Used by
 * the offline "Download for offline" flow to warm the SW's runtime cache.
 *
 * Naming conventions match the URLs the AudioEngine actually requests, so
 * each cached URL will be served verbatim when the matching note plays.
 */

// Vocal sample degrees. The AudioEngine sanitises '#' to 's' for URLs
// (see AudioEngine.preloadNotes), so we do the same here.
const VOCAL_DEGREES_RAW = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
const VOCAL_MIDI_MIN = 43; // G2
const VOCAL_MIDI_MAX = 67; // G4

const BASS_MIDI_MIN = 23;
const BASS_MIDI_MAX = 67;

const PIANO_MIDI_MIN = 23;
const PIANO_MIDI_MAX = 80;

// File-name stems for each tonic in public/loops/drones/{key}_drone.mp3
const DRONE_KEY_NAMES = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b'];

// Drum one-shot samples (public/samples/drums/*.mp3)
const DRUM_SAMPLES = [
  'clap', 'clave', 'crash', 'cymbal', 'floortom', 'hats_foot', 'hats_open',
  'hats_vinyl_edge', 'hihat', 'kick_goat', 'kick_soft', 'racktom', 'ride',
  'rimshot', 'shaker', 'snap', 'snare', 'stick', 'tambourine', 'triangle',
  'woodblock',
];

// Drum loop tracks (public/loops/drums/*.mp3)
const DRUM_LOOPS = ['groove_1_80bpm'];

/**
 * All audio URLs the app might play. Pass the same baseUrl the app uses
 * (typically `import.meta.env.BASE_URL`).
 */
export function getOfflineAudioUrls(baseUrl: string): string[] {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const urls: string[] = [];

  for (const deg of VOCAL_DEGREES_RAW) {
    const safe = deg.replace('#', 's');
    for (let m = VOCAL_MIDI_MIN; m <= VOCAL_MIDI_MAX; m++) {
      urls.push(`${base}samples/${safe}/${safe}_${m}.mp3`);
    }
  }
  for (let m = BASS_MIDI_MIN; m <= BASS_MIDI_MAX; m++) {
    urls.push(`${base}samples/bass/B_${m}.mp3`);
  }
  for (let m = PIANO_MIDI_MIN; m <= PIANO_MIDI_MAX; m++) {
    urls.push(`${base}samples/piano/P_${m}.mp3`);
  }
  for (const drum of DRUM_SAMPLES) {
    urls.push(`${base}samples/drums/${drum}.mp3`);
  }
  for (const key of DRONE_KEY_NAMES) {
    urls.push(`${base}loops/drones/${key}_drone.mp3`);
  }
  for (const loop of DRUM_LOOPS) {
    urls.push(`${base}loops/drums/${loop}.mp3`);
  }

  return urls;
}
