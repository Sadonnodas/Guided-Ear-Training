/**
 * Keeps the audio context alive in background (Pocket Mode) 
 * and bypasses the iOS silent switch.
 */

const SILENT_WAV = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

let audioEl: HTMLAudioElement | null = null;

export function initKeepAlive() {
  if (audioEl) return;

  audioEl = document.createElement("audio"); // Create properly
  audioEl.src = SILENT_WAV;
  audioEl.loop = true;
  audioEl.volume = 0.01;
  
  // CRITICAL FOR IOS BACKGROUND AUDIO:
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  
  // CRITICAL: Add to DOM so the browser treats it as a "real" media player
  // We hide it visually but keep it in the DOM structure
  audioEl.style.position = 'absolute';
  audioEl.style.top = '-9999px';
  audioEl.style.left = '-9999px';
  document.body.appendChild(audioEl);

  // Metadata for Lock Screen
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Ear Training",
      artist: "Active Session",
      album: "Guided Ear Training",
      artwork: []
    });
    navigator.mediaSession.setActionHandler('play', () => audioEl?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioEl?.pause());
  }
}

export function startKeepAlive() {
  if (audioEl && audioEl.paused) {
    audioEl.play().catch(e => {
        if (e.name !== 'AbortError') console.warn("KeepAlive play failed", e);
    });
  }
}

export function stopKeepAlive() {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}