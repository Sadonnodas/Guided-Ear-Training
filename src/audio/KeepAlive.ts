import * as Tone from "tone";

/**
 * KeepAlive.ts - Background Audio & Media Controls
 * 
 * VIDEO-BASED VERSION for better iOS persistence
 * 
 * iOS treats <video> elements with audio tracks differently than <audio> elements.
 * This might allow audio to persist through screen lock.
 */

let videoEl: HTMLVideoElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let bridgeGain: GainNode | null = null;
let isInitialized = false;
let isBridgeConnected = false;
let keepAliveInterval: number | null = null;

type PlaybackHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
};

let activeHandlers: PlaybackHandlers | null = null;

/**
 * Initialize using VIDEO element instead of audio
 * iOS gives video elements more privileges for background playback
 */
export function initKeepAlive(handlers: PlaybackHandlers) {
  activeHandlers = handlers;
  
  if (isInitialized) return;

  // Create VIDEO element instead of audio (KEY DIFFERENCE)
  videoEl = document.createElement("video");
  videoEl.id = "keep-alive-video";
  
  // Create a silent video file (1x1 black pixel with audio track)
  const silentVideoData = createSilentVideoBlob();
  videoEl.src = URL.createObjectURL(silentVideoData);
  
  videoEl.loop = true;
  videoEl.preload = "auto";
  videoEl.volume = 1.0;
  videoEl.muted = false; // Important: NOT muted
  
  // CRITICAL iOS video attributes for background playback
  videoEl.setAttribute("playsinline", "true");
  videoEl.setAttribute("webkit-playsinline", "true");
  
  // Make it tiny and hidden
  videoEl.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
  videoEl.width = 1;
  videoEl.height = 1;
  
  document.body.appendChild(videoEl);

  // Auto-restart if paused
  videoEl.addEventListener('pause', () => {
    if (keepAliveInterval !== null && videoEl) {
      console.log('[KeepAlive] Video paused - restarting');
      videoEl.play().catch(() => {});
    }
  });
  
  // Handle ended (shouldn't happen with loop, but be safe)
  videoEl.addEventListener('ended', () => {
    if (keepAliveInterval !== null && videoEl) {
      console.log('[KeepAlive] Video ended - restarting');
      videoEl.play().catch(() => {});
    }
  });

  // Setup MediaSession
  setupMediaSession();

  isInitialized = true;
}

/**
 * Creates a minimal WebM video file with silent audio track
 * iOS handles video + audio better than audio alone
 */
function createSilentVideoBlob(): Blob {
  // This is a minimal valid WebM file (1 frame, 1 second, with silent audio)
  // Generated using ffmpeg: ffmpeg -f lavfi -i color=black:s=1x1:d=1 -f lavfi -i anullsrc=r=44100:cl=mono -shortest -c:v libvpx -c:a libvorbis output.webm
  
  // For now, use a data URL approach (WebM is complex to generate in JS)
  // Alternative: Base64 embed a tiny pre-generated WebM file
  
  // Fallback to MP4 data URL (more universally supported)
  // This is a 1-second silent video (1x1 pixel black)
  const mp4Data = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAuBtZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAAV/78dAAAAwEGaAQAV/78dAAAAwEGaIQAV/78dAAAAwEGaYQAV/78dAAAAwEGagQAV/78dAAAAwEGaoQAV/78dAAAAwEGawQAV/78dAAAAwEGa4QAV/78dAAAAwEGbAQAThAAAAMABmyEAE4QAAAAlm1RYXQAAAThtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABFHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAQAAAABAAAAAAAkkZHRzAAAAEHN0c2MAAAAAAAAAAwAAAAEAAAABAAAAAQAAABRzdGNvAAAAAAAAAAEAAAAsAAAAYnN0c2MAAAAAAAAAAQAAAAEAAAABAAAAASRzdHN6AAAAAAAAAAAAAAABAAAAHAAAABRzdHRzAAAAAAAAAAEAAAABAAAAZAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RjbwAAAAAAAAABAAAALAAAAGJzdHN6AAAAAAAAAAAAAAABAAAAHAAAABRzdHRzAAAAAAAAAAEAAAABAAAAZAAAABhzdHNkAAAAAAAAAAEAAAABAAAAACgAAAAAAAAAHHVybCAAAABydWRhdGEAAAABAAAAG21ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTcuODMuMTAw";
  
  return dataURLToBlob(mp4Data);
}

/**
 * Convert data URL to Blob
 */
function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'video/mp4';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
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

  // Handle lock screen controls
  navigator.mediaSession.setActionHandler('play', () => { 
    if (activeHandlers) activeHandlers.onPlay(); 
  });
  
  navigator.mediaSession.setActionHandler('pause', () => { 
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
 * Update lock screen state
 */
export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }
}

/**
 * Start the video-based keep alive
 */
export async function startKeepAlive(): Promise<void> {
  if (Tone.context.state !== 'running') {
    await Tone.context.resume();
  }

  if (!videoEl) {
    console.warn("KeepAlive: Not initialized");
    return;
  }

  // Connect video audio to Web Audio graph
  if (!isBridgeConnected) {
    try {
      const ctx = Tone.context.rawContext as AudioContext;
      
      mediaSource = ctx.createMediaElementSource(videoEl);
      bridgeGain = ctx.createGain();
      bridgeGain.gain.value = 0.001;
      
      mediaSource.connect(bridgeGain);
      bridgeGain.connect(ctx.destination);
      
      isBridgeConnected = true;
    } catch (e) {
      console.error("KeepAlive: Failed to create bridge", e);
      return;
    }
  }

  // Start video playback
  if (videoEl.paused) {
    try {
      await videoEl.play();
      console.log('[KeepAlive] Silent video started');
    } catch (e) {
      console.warn("KeepAlive: Failed to play video", e);
    }
  }
  
  // Watchdog
  if (keepAliveInterval === null) {
    keepAliveInterval = window.setInterval(() => {
      if (videoEl && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
      
      const ctx = Tone.context.rawContext as AudioContext;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      
      if (bridgeGain) {
        const current = bridgeGain.gain.value;
        bridgeGain.gain.setValueAtTime(current * 0.999, ctx.currentTime);
        bridgeGain.gain.setValueAtTime(current, ctx.currentTime + 0.01);
      }
    }, 2000);
    
    console.log('[KeepAlive] Watchdog started');
  }
  
  updateMediaSessionState(true);
}

/**
 * Stop keep alive
 */
export function stopKeepAlive() {
  if (keepAliveInterval !== null) {
    window.clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  if (videoEl && !videoEl.paused) {
    videoEl.pause();
  }
  
  updateMediaSessionState(false);
}

/**
 * Check if active
 */
export function isKeepAliveActive(): boolean {
  return videoEl ? !videoEl.paused : false;
}

/**
 * Reset
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
  
  if (videoEl) {
    videoEl.remove();
    videoEl = null;
  }
  
  isInitialized = false;
  isBridgeConnected = false;
  activeHandlers = null;
}