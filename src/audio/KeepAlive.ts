/**
 * Keeps the audio context alive in background (Pocket Mode) 
 * and bypasses the iOS silent switch.
 */

// FIX: Switched to a standard WAV header (Universally supported)
// This is a 0.1s silent WAV file.
const SILENT_WAV = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

let audioEl: HTMLAudioElement | null = null;

export function initKeepAlive() {
  if (audioEl) return;

  // Create an invisible audio element
  audioEl = new Audio();
  audioEl.src = SILENT_WAV; // Use WAV instead of MP3
  audioEl.loop = true;
  audioEl.volume = 0.01; // Non-zero volume is required for iOS
  
  // Set Media Session metadata (Shows on Lock Screen)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Ear Training",
      artist: "Active Session",
      album: "Guided Ear Training",
      artwork: []
    });

    // Dummy handlers to prevent the OS from killing the audio
    navigator.mediaSession.setActionHandler('play', () => audioEl?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioEl?.pause());
  }
}

export function startKeepAlive() {
  // This must be called inside a user interaction (click/touch)
  if (audioEl && audioEl.paused) {
    audioEl.play().catch(e => {
        // Ignore "AbortError" (happens if you click stop quickly)
        // But log others
        if (e.name !== 'AbortError') {
            console.warn("KeepAlive play failed", e);
        }
    });
  }
}

export function stopKeepAlive() {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0; // Reset
  }
}