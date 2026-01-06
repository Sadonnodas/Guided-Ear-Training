import * as Tone from "tone";

/**
 * Keeps the audio context alive in background (Pocket Mode) 
 * by bridging an HTML5 Audio Element into the Web Audio Context.
 */

const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;

export function initKeepAlive(onTogglePlay?: () => void) {
  if (audioEl) return;

  audioEl = document.createElement("audio");
  audioEl.src = SILENT_WAV;
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 0.01; // iOS requires non-zero volume to keep context alive
  
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("webkit-playsinline", "true");
  audioEl.crossOrigin = "anonymous";
  audioEl.style.display = "none";
  document.body.appendChild(audioEl);

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Ear Training",
      artist: "Active Session",
      album: "Guided Ear Training",
      artwork: [
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '512x512', type: 'image/png' }
      ]
    });

    // These handlers allow the lock screen play/pause buttons to work
    navigator.mediaSession.setActionHandler('play', () => {
        if (onTogglePlay) onTogglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (onTogglePlay) onTogglePlay();
    });
  }
}

// Add this helper to update the lock screen icon (Play vs Pause)
export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }
}

export async function startKeepAlive() {
  if (!audioEl) initKeepAlive();
  
  // 3. Connect HTML Audio -> Tone Context
  if (audioEl && !mediaSource) {
      try {
          if (Tone.context.state !== 'running') await Tone.context.resume();
          
          // Create the native bridge
          mediaSource = Tone.context.createMediaElementSource(audioEl);
          
          // FIX: Create a Tone.Gain, but access its raw input node for connection
          const zeroGain = new Tone.Gain(0).toDestination();
          
          // Connect native node -> Tone node using the Tone helper
          Tone.connect(mediaSource, zeroGain); 
      } catch (e) {
          console.warn("KeepAlive: Failed to connect to Tone context", e);
      }
  }

  // 4. Play
  if (audioEl && audioEl.paused) {
    try {
        await audioEl.play();
    } catch (e) {
        console.warn("KeepAlive play failed", e);
    }
  }
}

export function stopKeepAlive() {
  if (audioEl) {
    audioEl.pause();
    // Don't disconnect mediaSource, keep it for next time
  }
}