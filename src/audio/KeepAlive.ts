import * as Tone from "tone";

/**
 * Keeps the audio context alive in background (Pocket Mode) 
 * and handles Lock Screen / Bluetooth controls.
 * 
 * CRITICAL FOR IOS:
 * - Uses a silent audio element to keep the WebAudio context active
 * - Connects it to the audio graph with very low gain (not zero!)
 * - Implements proper MediaSession for lock screen controls
 */

const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let bridgeGain: GainNode | null = null;
let isInitialized = false;

type PlaybackHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
};

let activeHandlers: PlaybackHandlers | null = null;

/**
 * Initialize the background audio system
 * MUST be called before any audio playback
 */
export function initKeepAlive(handlers: PlaybackHandlers) {
  if (isInitialized) {
    // Just update handlers if already initialized
    activeHandlers = handlers;
    return;
  }

  activeHandlers = handlers;
  
  // Create the silent audio element
  audioEl = document.createElement("audio");
  audioEl.src = SILENT_WAV;
  audioEl.loop = true;
  audioEl.preload = "auto";
  
  // CRITICAL: Volume must be non-zero for iOS to treat this as "real" audio
  audioEl.volume = 1.0;
  
  // iOS-specific attributes for background playback
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  audioEl.setAttribute("x-webkit-airplay", "allow");
  
  // Hide from view but keep in DOM
  audioEl.style.display = "none";
  audioEl.style.position = "absolute";
  audioEl.style.left = "-9999px";
  
  document.body.appendChild(audioEl);

  // Setup MediaSession for lock screen controls
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Guided Ear Training",
      artist: "Active Session",
      album: "Ear Training Practice",
      artwork: [
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '96x96', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '128x128', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '192x192', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '256x256', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '384x384', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '512x512', type: 'image/png' }
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

    // Prevent default seeking behavior
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('seekto', null);
  }

  isInitialized = true;
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
 * Start the background audio bridge
 * This MUST be called from a user gesture (click/tap)
 */
export async function startKeepAlive() {
  // Ensure Tone.js context is running
  if (Tone.context.state !== 'running') {
    await Tone.context.resume();
  }

  if (!audioEl) {
    console.warn("KeepAlive: Not initialized, call initKeepAlive first");
    return;
  }

  // Create the audio bridge if not already connected
  if (!mediaSource) {
    try {
      const ctx = Tone.context.rawContext as AudioContext;
      
      // CRITICAL: Create source from the silent audio element
      mediaSource = ctx.createMediaElementSource(audioEl);
      
      // CRITICAL: Use a very low gain (not zero!) to keep iOS happy
      // iOS will suspend audio contexts with completely silent graphs
      bridgeGain = ctx.createGain();
      bridgeGain.gain.value = 0.0001; // Inaudible but non-zero
      
      // Connect: silentAudio -> bridgeGain -> destination
      mediaSource.connect(bridgeGain);
      bridgeGain.connect(ctx.destination);
    } catch (e) {
      console.error("KeepAlive: Failed to create audio bridge", e);
      return;
    }
  }

  // Start playing the silent audio (non-blocking)
  if (audioEl.paused) {
    audioEl.play().catch(e => console.warn("KeepAlive: Failed to play silent audio", e));
  }
}

/**
 * Stop the background audio (allows system to sleep)
 */
export function stopKeepAlive() {
  if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
  
  // Update lock screen to show paused state
  updateMediaSessionState(false);
}

/**
 * Reset the entire system (for testing/debugging)
 */
export function resetKeepAlive() {
  stopKeepAlive();
  
  if (mediaSource) {
    mediaSource.disconnect();
    mediaSource = null;
  }
  
  if (bridgeGain) {
    bridgeGain.disconnect();
    bridgeGain = null;
  }
  
  if (audioEl) {
    audioEl.remove();
    audioEl = null;
  }
  
  isInitialized = false;
  activeHandlers = null;
}