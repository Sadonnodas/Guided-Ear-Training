import * as Tone from "tone";

/**
 * KeepAlive.ts - Background Audio & Media Controls
 * 
 * ENHANCED VERSION v2 - iOS Screen Lock Audio Persistence
 * 
 * Keeps the audio context alive when:
 * - Screen is locked
 * - App is backgrounded
 * - iOS Silent Mode is on
 * 
 * Also handles Lock Screen / Bluetooth controls via MediaSession API.
 */

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let bridgeGain: GainNode | null = null;
let isInitialized = false;
let isBridgeConnected = false;
let keepAliveInterval: number | null = null;
let visibilityWakeLock: any = null; // For Screen Wake Lock API

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
  
  // CRITICAL: Use a very short but real audio file
  // iOS treats looping short audio differently than long silent files
  const silentAudioData = createShortSilentAudio();
  audioEl.src = URL.createObjectURL(silentAudioData);
  
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 1.0; // Must be non-zero for iOS
  
  // Critical iOS attributes
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  audioEl.setAttribute("x-webkit-airplay", "allow");
  
  // Mark as "music" content, not effects
  audioEl.setAttribute("x5-audio-mode", "music"); // For some browsers
  
  // Hide from view
  audioEl.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(audioEl);

  // CRITICAL: Listen for system pause and restart aggressively
  audioEl.addEventListener('pause', handleAudioPause);
  audioEl.addEventListener('ended', handleAudioEnded);
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Setup MediaSession for lock screen controls
  setupMediaSession();

  // Request wake lock if available
  requestWakeLock();

  isInitialized = true;
}

/**
 * Handle when iOS tries to pause our audio
 */
function handleAudioPause() {
  // If we're supposed to be playing (watchdog is active), restart immediately
  if (keepAliveInterval !== null && audioEl) {
    console.log('[KeepAlive] System paused audio - restarting');
    // Small delay to avoid iOS blocking the restart
    setTimeout(() => {
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(err => console.warn('[KeepAlive] Restart failed:', err));
      }
    }, 100);
  }
}

/**
 * Handle when audio ends (shouldn't happen with loop=true, but be safe)
 */
function handleAudioEnded() {
  if (keepAliveInterval !== null && audioEl) {
    console.log('[KeepAlive] Audio ended - restarting');
    audioEl.play().catch(() => {});
  }
}

/**
 * Handle visibility changes (screen lock, app background)
 */
function handleVisibilityChange() {
  if (document.hidden) {
    console.log('[KeepAlive] App backgrounded');
    // Ensure audio keeps playing
    if (keepAliveInterval !== null && audioEl && audioEl.paused) {
      audioEl.play().catch(() => {});
    }
  } else {
    console.log('[KeepAlive] App foregrounded');
    // Resume if needed
    if (keepAliveInterval !== null) {
      const ctx = Tone.context.rawContext as AudioContext;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
  }
}

/**
 * Creates a SHORT silent WAV audio blob (100ms)
 * iOS handles short looping audio better than long files
 */
function createShortSilentAudio(): Blob {
  const sampleRate = 44100;
  const seconds = 0.1; // 100ms - short and sweet
  const numSamples = Math.floor(sampleRate * seconds);
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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Request screen wake lock if available
 */
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      visibilityWakeLock = await (navigator as any).wakeLock.request('screen');
      console.log('[KeepAlive] Wake lock acquired');
      
      // Reacquire on visibility change
      document.addEventListener('visibilitychange', async () => {
        if (visibilityWakeLock !== null && document.visibilityState === 'visible') {
          try {
            visibilityWakeLock = await (navigator as any).wakeLock.request('screen');
          } catch (err) {
            console.warn('[KeepAlive] Wake lock reacquisition failed');
          }
        }
      });
    } catch (err) {
      console.log('[KeepAlive] Wake lock not available');
    }
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
    title: "Ear Training Session",
    artist: "Guided Ear Training",
    album: "Active Practice",
    artwork: [
      { src: `${baseUrl}icon.png`, sizes: '96x96', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '128x128', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '192x192', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '256x256', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '384x384', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '512x512', type: 'image/png' }
    ]
  });

  // CRITICAL: Set position state to trick iOS into thinking this is real media
  try {
    navigator.mediaSession.setPositionState({
      duration: 3600, // 1 hour "duration"
      playbackRate: 1,
      position: 0
    });
  } catch (err) {
    // Not all browsers support this
  }

  // Handle lock screen/bluetooth controls
  navigator.mediaSession.setActionHandler('play', () => { 
    console.log('[KeepAlive] MediaSession play');
    if (activeHandlers) activeHandlers.onPlay(); 
  });
  
  navigator.mediaSession.setActionHandler('pause', () => { 
    console.log('[KeepAlive] MediaSession pause');
    if (activeHandlers) activeHandlers.onPause(); 
  });
  
  navigator.mediaSession.setActionHandler('nexttrack', () => { 
    if (activeHandlers?.onNext) activeHandlers.onNext(); 
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    if (activeHandlers) activeHandlers.onPause();
  });
  
  // Disable seeking
  navigator.mediaSession.setActionHandler('seekbackward', null);
  navigator.mediaSession.setActionHandler('seekforward', null);
  navigator.mediaSession.setActionHandler('seekto', null);
}

/**
 * Update the lock screen playback state
 */
export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    
    // Update position to show progression (tricks iOS)
    if (isPlaying) {
      try {
        const elapsed = Math.floor(Date.now() / 1000) % 3600;
        navigator.mediaSession.setPositionState({
          duration: 3600,
          playbackRate: 1,
          position: elapsed
        });
      } catch (err) {
        // Ignore
      }
    }
  }
}

/**
 * ENHANCED: Start the background audio bridge with aggressive persistence.
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
      
      // CRITICAL: Use audible but very quiet gain
      // Completely silent = iOS may suspend
      bridgeGain = ctx.createGain();
      bridgeGain.gain.value = 0.001; // Inaudible on most devices
      
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
      console.log('[KeepAlive] Silent audio started');
    } catch (e) {
      console.warn("KeepAlive: Failed to play silent audio", e);
    }
  }
  
  // Start aggressive watchdog timer
  if (keepAliveInterval === null) {
    keepAliveInterval = window.setInterval(() => {
      // 1. Ensure audio element is playing
      if (audioEl && audioEl.paused) {
        console.log('[KeepAlive] Watchdog restarting audio');
        audioEl.play().catch(() => {});
      }
      
      // 2. Ensure audio context is running
      const ctx = Tone.context.rawContext as AudioContext;
      if (ctx.state === 'suspended') {
        console.log('[KeepAlive] Watchdog resuming context');
        ctx.resume().catch(() => {});
      }
      
      // 3. Tiny gain oscillation (keeps iOS active)
      if (bridgeGain) {
        const current = bridgeGain.gain.value;
        bridgeGain.gain.setValueAtTime(current * 0.999, ctx.currentTime);
        bridgeGain.gain.setValueAtTime(current, ctx.currentTime + 0.01);
      }
      
      // 4. Update MediaSession position
      updateMediaSessionState(true);
    }, 1000); // Check every second (more aggressive)
    
    console.log('[KeepAlive] Watchdog started (1s interval)');
  }
  
  updateMediaSessionState(true);
}

/**
 * Stop the background audio (allows system to sleep)
 */
export function stopKeepAlive() {
  // Clear watchdog timer
  if (keepAliveInterval !== null) {
    window.clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KeepAlive] Watchdog stopped');
  }

  if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
  
  // Release wake lock
  if (visibilityWakeLock !== null) {
    try {
      visibilityWakeLock.release();
      visibilityWakeLock = null;
    } catch (err) {
      // Ignore
    }
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
  
  // Clean up event listeners
  if (audioEl) {
    audioEl.removeEventListener('pause', handleAudioPause);
    audioEl.removeEventListener('ended', handleAudioEnded);
  }
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
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