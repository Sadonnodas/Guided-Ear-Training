import * as Tone from "tone";

/**
 * KeepAlive.ts - Background Audio & Media Controls
 * 
 * iOS Screen Lock Audio Persistence + Lock Screen Controls
 * 
 * Keeps audio alive when screen locks while maintaining lock screen controls.
 */

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let bridgeGain: GainNode | null = null;
let isInitialized = false;
let isBridgeConnected = false;
let keepAliveInterval: number | null = null;
let userIntendedPause = false; // Track if user deliberately paused

type PlaybackHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
};

let activeHandlers: PlaybackHandlers | null = null;

/**
 * Initialize the background audio system.
 */
export function initKeepAlive(handlers: PlaybackHandlers) {
  activeHandlers = handlers;
  
  if (isInitialized) return;

  // Create the silent audio element
  audioEl = document.createElement("audio");
  audioEl.id = "keep-alive-audio";
  
  // Shorter silent audio for better iOS loop handling
  const silentAudioData = createShortSilentAudio();
  audioEl.src = URL.createObjectURL(silentAudioData);
  
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 1.0; // Must be non-zero for iOS
  
  // Critical iOS attributes
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  audioEl.setAttribute("x-webkit-airplay", "allow");
  
  // Hide from view
  audioEl.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(audioEl);

  // Handle system pauses (but respect user intent)
  audioEl.addEventListener('pause', handleAudioPause);
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Setup MediaSession for lock screen controls
  setupMediaSession();

  isInitialized = true;
}

/**
 * Handle when audio element pauses
 */
function handleAudioPause() {
  // Only restart if:
  // 1. Watchdog is active (session is playing)
  // 2. User didn't deliberately pause
  if (keepAliveInterval !== null && !userIntendedPause && audioEl) {
    console.log('[KeepAlive] System paused audio - restarting');
    setTimeout(() => {
      if (audioEl && audioEl.paused && !userIntendedPause) {
        audioEl.play().catch(() => {});
      }
    }, 100);
  }
}

/**
 * Handle visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // App backgrounded - keep audio alive if session is active
    if (keepAliveInterval !== null && !userIntendedPause && audioEl && audioEl.paused) {
      audioEl.play().catch(() => {});
    }
  } else {
    // App foregrounded - resume context if needed
    if (keepAliveInterval !== null && !userIntendedPause) {
      const ctx = Tone.context.rawContext as AudioContext;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
  }
}

/**
 * Creates a SHORT silent WAV (200ms for better iOS compatibility)
 */
function createShortSilentAudio(): Blob {
  const sampleRate = 44100;
  const seconds = 0.2; // 200ms
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
  view.setUint16(20, 1, true);
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
 * Setup MediaSession for lock screen controls
 */
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  
  const baseUrl = typeof import.meta !== 'undefined' 
    ? import.meta.env?.BASE_URL || '/'
    : '/';

  navigator.mediaSession.metadata = new MediaMetadata({
    title: "Ear Training Session",
    artist: "Guided Ear Training",
    album: "Practice Session",
    artwork: [
      { src: `${baseUrl}icon.png`, sizes: '96x96', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '128x128', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '192x192', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '256x256', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '384x384', type: 'image/png' },
      { src: `${baseUrl}icon.png`, sizes: '512x512', type: 'image/png' }
    ]
  });

  // Set position state to make iOS treat this as real media
  try {
    navigator.mediaSession.setPositionState({
      duration: 3600,
      playbackRate: 1,
      position: 0
    });
  } catch (err) {
    // Not all browsers support this
  }

  // Lock screen controls
  navigator.mediaSession.setActionHandler('play', () => { 
    console.log('[KeepAlive] Lock screen PLAY');
    userIntendedPause = false; // User wants to play
    if (activeHandlers) activeHandlers.onPlay(); 
  });
  
  navigator.mediaSession.setActionHandler('pause', () => { 
    console.log('[KeepAlive] Lock screen PAUSE');
    userIntendedPause = true; // User wants to pause
    if (activeHandlers) activeHandlers.onPause(); 
  });
  
  navigator.mediaSession.setActionHandler('nexttrack', () => { 
    if (activeHandlers?.onNext) activeHandlers.onNext(); 
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    console.log('[KeepAlive] Lock screen STOP');
    userIntendedPause = true;
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
    
    // Update position for iOS
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
 * Start the background audio bridge.
 * MUST be called from a user gesture.
 */
export async function startKeepAlive(): Promise<void> {
  console.log('[KeepAlive] Starting...');
  
  // Clear user pause flag when explicitly starting
  userIntendedPause = false;
  
  // Ensure Tone.js context is running
  if (Tone.context.state !== 'running') {
    await Tone.context.resume();
  }

  if (!audioEl) {
    console.warn("KeepAlive: Not initialized");
    return;
  }

  // Connect audio bridge (only once)
  if (!isBridgeConnected) {
    try {
      const ctx = Tone.context.rawContext as AudioContext;
      
      mediaSource = ctx.createMediaElementSource(audioEl);
      bridgeGain = ctx.createGain();
      bridgeGain.gain.value = 0.001; // Inaudible but non-zero
      
      mediaSource.connect(bridgeGain);
      bridgeGain.connect(ctx.destination);
      
      isBridgeConnected = true;
    } catch (e) {
      console.error("KeepAlive: Failed to create bridge", e);
      return;
    }
  }

  // Start silent audio
  if (audioEl.paused) {
    try {
      await audioEl.play();
      console.log('[KeepAlive] Silent audio started');
    } catch (e) {
      console.warn("KeepAlive: Failed to play", e);
    }
  }
  
  // Start watchdog
  if (keepAliveInterval === null) {
    keepAliveInterval = window.setInterval(() => {
      // Only keep alive if user hasn't paused
      if (!userIntendedPause) {
        // 1. Restart audio if needed
        if (audioEl && audioEl.paused) {
          audioEl.play().catch(() => {});
        }
        
        // 2. Resume context if needed
        const ctx = Tone.context.rawContext as AudioContext;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        
        // 3. Tiny gain oscillation
        if (bridgeGain) {
          const current = bridgeGain.gain.value;
          bridgeGain.gain.setValueAtTime(current * 0.999, ctx.currentTime);
          bridgeGain.gain.setValueAtTime(current, ctx.currentTime + 0.01);
        }
        
        // 4. Update MediaSession
        updateMediaSessionState(true);
      }
    }, 1500); // Every 1.5 seconds
    
    console.log('[KeepAlive] Watchdog started');
  }
  
  updateMediaSessionState(true);
}

/**
 * Stop the background audio
 */
export function stopKeepAlive() {
  console.log('[KeepAlive] Stopping...');
  
  // Set user pause flag
  userIntendedPause = true;
  
  // Clear watchdog
  if (keepAliveInterval !== null) {
    window.clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
  
  updateMediaSessionState(false);
}

/**
 * Check if active
 */
export function isKeepAliveActive(): boolean {
  return audioEl ? !audioEl.paused : false;
}

/**
 * Reset everything
 */
export function resetKeepAlive() {
  stopKeepAlive();
  
  // Clean up listeners
  if (audioEl) {
    audioEl.removeEventListener('pause', handleAudioPause);
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
  userIntendedPause = false;
}