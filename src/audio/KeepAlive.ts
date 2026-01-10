import * as Tone from "tone";

/**
 * Keeps the audio context alive in background (Pocket Mode) 
 * and handles Lock Screen / Bluetooth controls.
 */

const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

let audioEl: HTMLAudioElement | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;

type PlaybackHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext?: () => void;
};

let activeHandlers: PlaybackHandlers | null = null;

export function initKeepAlive(handlers: PlaybackHandlers) {
  activeHandlers = handlers;
  
  if (audioEl) return;

  audioEl = document.createElement("audio");
  audioEl.src = SILENT_WAV;
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.volume = 1.0; // iOS sometimes needs non-zero volume to prevent muting
  
  // CRITICAL for iOS Background Audio
  audioEl.setAttribute("playsinline", "true");
  audioEl.setAttribute("x-webkit-airplay", "allow");
  
  audioEl.style.display = "none";
  document.body.appendChild(audioEl);

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Guided Ear Training",
      artist: "Active Session",
      album: "Ear Training App",
      artwork: [
        { src: `${import.meta.env.BASE_URL}icon.png`, sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => { if (activeHandlers) activeHandlers.onPlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { if (activeHandlers) activeHandlers.onPause(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { if (activeHandlers?.onNext) activeHandlers.onNext(); });
  }
}

export function updateMediaSessionState(isPlaying: boolean) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }
}

export async function startKeepAlive() {
  if (Tone.context.state !== 'running') await Tone.context.resume();
  if (!audioEl) return;

  // RE-ESTABLISH THE BRIDGE
  if (!mediaSource) {
      try {
          const ctx = Tone.context.rawContext as AudioContext;
          mediaSource = ctx.createMediaElementSource(audioEl);
          
          // Connect to a Gain that is NOT zero, but very low, to fool iOS
          const bridgeGain = ctx.createGain();
          bridgeGain.gain.value = 0.001; 
          
          mediaSource.connect(bridgeGain);
          bridgeGain.connect(ctx.destination);
          
          console.log("KeepAlive: Bridge active.");
      } catch (e) {
          console.warn("KeepAlive: Bridge connection issue", e);
      }
  }

  if (audioEl.paused) {
      audioEl.play().catch(e => console.warn("KeepAlive play failed", e));
  }
}

export function stopKeepAlive() {
  if (audioEl) audioEl.pause();
}