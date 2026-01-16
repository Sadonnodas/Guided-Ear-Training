import * as Tone from "tone";

/**
 * KeepAlive.ts - Background Audio & Media Controls
 * 
 * Keeps the audio context alive when:
 * - Screen is off (Pocket Mode)
 * - iOS Silent Mode switch is on
 * - App is in background
 * 
 * Also handles Lock Screen / Bluetooth controls via MediaSession API.
 */

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let bridgeGain: GainNode | null = null;
let isInitialized = false;
let isBridgeConnected = false;

type PlaybackHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
};

let activeHandlers: PlaybackHandlers | null = null;

/**
 * Initialize the background audio system.
 * Call this early (on mount) to set up handlers.
 * The actual audio bridge starts on first user interaction.
 */
export function initKeepAlive(handlers: PlaybackHandlers) {
  activeHandlers = handlers;
  
  if (isInitialized) return;

  // Create the silent audio element
  audioEl = document.createElement("audio");
  audioEl.id = "keep-alive-audio";
  
  // Use a longer silent audio for better iOS compatibility
  // Create a proper silent audio blob
  const silentAudioData = createSilentAudioBlob();
  audioEl.src = URL.createObjectURL(silentAudioData);
  
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 1.0; // Must be non-zero for iOS
  
  // Critical iOS attributes
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  audioEl.setAttribute("x-webkit-airplay", "allow");
  
  // For iOS Silent Mode - treat as media, not sound effect
  (audioEl as any).mozAudioChannelType = "content";
  
  // Hide from view
  audioEl.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(audioEl);

  // Setup MediaSession for lock screen controls
  setupMediaSession();

  isInitialized = true;
}

/**
 * Creates a proper silent WAV audio blob
 */
function createSilentAudioBlob(): Blob {
  const sampleRate = 44100;
  const seconds = 1;
  const numSamples = sampleRate * seconds;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  // Audio data is all zeros (silence) - already initialized by ArrayBuffer
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Setup MediaSession for lock screen / bluetooth controls
 */
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  
  const baseUrl = typeof import.meta !== 'undefined' 
    ? import.meta.env?.BASE_URL || '/'
    : '/';

  navigator.mediaSession.metadata = new MediaMetadata({
    title: "Guided Ear Training",
    artist: "Active Session",
    album: "Ear Training Practice",
    artwork: [
      { src: `${baseUrl}icon.png`, sizes: '96x96', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '128x128', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '192x192', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '256x256', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '384x384', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '512x512', type: 'image/png' }
    ]
  });

  // Handle lock screen/bluetooth controls
  navigator.mediaSession.setActionHandler('play', () => { 
    if (activeHandlers) activeHandlers.onPlay(); 
  });
  
  navigator.mediaSession.setActionHandler('pause', () => { 
    if (activeHandlers) activeHandlers.onPause(); 
  });
  
  navigator.mediaSession.setActionHandler('nexttrack', () => { 
    if (activeHandlers?.onNext) activeHandlers.onNext(); 
  });

  // Disable seeking (not applicable for this app)
  navigator.mediaSession.setActionHandler('seekbackward', null);
  navigator.mediaSession.setActionHandler('seekforward', null);
  navigator.mediaSession.setActionHandler('seekto', null);
  navigator.mediaSession.setActionHandler('stop', () => {
    if (activeHandlers) activeHandlers.onPause();
  });
}

/**
 * Update the lock screen playback state
 */
export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }
}

/**
 * Start the background audio bridge.
 * MUST be called from a user gesture (click/tap) for iOS compatibility.
 */
export async function startKeepAlive(): Promise<void> {
  // Ensure Tone.js context is running
  if (Tone.context.state !== 'running') {
    await Tone.context.resume();
  }

  if (!audioEl) {
    console.warn("KeepAlive: Not initialized. Call initKeepAlive first.");
    return;
  }

  // Connect the audio bridge to Web Audio graph (only once)
  if (!isBridgeConnected) {
    try {
      const ctx = Tone.context.rawContext as AudioContext;
      
      // Create source from the silent audio element
      mediaSource = ctx.createMediaElementSource(audioEl);
      
      // Use a tiny but non-zero gain to keep iOS happy
      // iOS suspends audio contexts with completely silent graphs
      bridgeGain = ctx.createGain();
      bridgeGain.gain.value = 0.001; // Inaudible but non-zero
      
      // Connect: silentAudio -> bridgeGain -> destination
      mediaSource.connect(bridgeGain);
      bridgeGain.connect(ctx.destination);
      
      isBridgeConnected = true;
    } catch (e) {
      console.error("KeepAlive: Failed to create audio bridge", e);
      return;
    }
  }

  // Start playing the silent audio
  if (audioEl.paused) {
    try {
      await audioEl.play();
    } catch (e) {
      console.warn("KeepAlive: Failed to play silent audio", e);
    }
  }
  
  updateMediaSessionState(true);
}

/**
 * Stop the background audio (allows system to sleep)
 */
export function stopKeepAlive() {
  if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
  
  updateMediaSessionState(false);
}

/**
 * Check if the keep-alive bridge is active
 */
export function isKeepAliveActive(): boolean {
  return audioEl ? !audioEl.paused : false;
}

/**
 * Reset the entire system (for debugging/testing)
 */
export function resetKeepAlive() {
  stopKeepAlive();
  
  if (mediaSource) {
    try {
      mediaSource.disconnect();
    } catch (e) { /* ignore */ }
    mediaSource = null;
  }
  
  if (bridgeGain) {
    try {
      bridgeGain.disconnect();
    } catch (e) { /* ignore */ }
    bridgeGain = null;
  }
  
  if (audioEl) {
    audioEl.remove();
    audioEl = null;
  }
  
  isInitialized = false;
  isBridgeConnected = false;
  activeHandlers = null;
}