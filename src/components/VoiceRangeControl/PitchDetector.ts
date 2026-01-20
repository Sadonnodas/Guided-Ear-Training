/**
 * PitchDetector.ts
 * 
 * Utility for detecting pitch from microphone input
 * Uses autocorrelation for accurate pitch detection
 */

export interface PitchDetectionResult {
  frequency: number;
  midi: number;
  confidence: number;
}

export class PitchDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private bufferLength = 0;
  private buffer = new Float32Array(0);
  private sampleRate = 44100;

  async initialize(): Promise<void> {
    // Request microphone access
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
    } catch (e) {
      throw new Error('Microphone access denied. Please grant permission.');
    }

    // Create audio context
    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;

    // Create analyzer
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect microphone
    this.microphone = this.audioContext.createMediaStreamSource(this.stream);
    this.microphone.connect(this.analyser);

    // Setup buffer
    this.bufferLength = this.analyser.fftSize;
    this.buffer = new Float32Array(this.bufferLength);
  }

  /**
   * Get current pitch from microphone
   */
  detectPitch(): PitchDetectionResult | null {
    if (!this.analyser) return null;

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.buffer);

    // Calculate RMS to detect if there's any sound
    const rms = Math.sqrt(
      this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
    );

    // Ignore if too quiet (threshold can be adjusted)
    if (rms < 0.01) return null;

    // Use autocorrelation to find pitch
    const frequency = this.autoCorrelate(this.buffer, this.sampleRate);
    
    if (frequency === -1) return null;

    // Convert frequency to MIDI
    const midi = this.frequencyToMidi(frequency);

    return {
      frequency,
      midi: Math.round(midi),
      confidence: rms
    };
  }

  /**
   * Autocorrelation algorithm for pitch detection
   * Based on https://github.com/cwilso/PitchDetect
   */
  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    // Find the size of the buffer
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    
    // Initialize variables
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    
    // Calculate RMS
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    
    // Not enough signal
    if (rms < 0.01) return -1;

    // Find the first crossing at 0
    let last_offset = -1;
    for (let i = 1; i < SIZE; i++) {
      if (buffer[i - 1] > 0 && buffer[i] <= 0) {
        last_offset = i;
        break;
      }
    }
    
    if (last_offset === -1) return -1;

    // Autocorrelation
    for (let offset = last_offset; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;

      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }

      correlation = 1 - correlation / MAX_SAMPLES;

      if (correlation > 0.9 && correlation > best_correlation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    }

    if (best_correlation > 0.01) {
      // Refine offset using parabolic interpolation
      const x1 = best_offset - 1;
      const x2 = best_offset;
      const x3 = best_offset + 1;

      let c1 = 0, c2 = 0, c3 = 0;

      for (let i = 0; i < MAX_SAMPLES; i++) {
        c1 += Math.abs(buffer[i] - buffer[i + x1]);
        c2 += Math.abs(buffer[i] - buffer[i + x2]);
        c3 += Math.abs(buffer[i] - buffer[i + x3]);
      }

      c1 = 1 - c1 / MAX_SAMPLES;
      c2 = 1 - c2 / MAX_SAMPLES;
      c3 = 1 - c3 / MAX_SAMPLES;

      const better_offset = x2 + 
        0.5 * ((c1 - c3) / (2 * c2 - c1 - c3));

      return sampleRate / better_offset;
    }

    return -1;
  }

  /**
   * Convert frequency to MIDI note number
   */
  private frequencyToMidi(frequency: number): number {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }
}

/**
 * Main calibration function - guides user through singing low and high notes
 */
export async function calibrateVocalRange(): Promise<{ min: number; max: number }> {
  const detector = new PitchDetector();
  
  try {
    await detector.initialize();

    // Collect low note
    const lowNote = await new Promise<number>((resolve, reject) => {
      const samples: number[] = [];
      let countdown = 3;
      
      const instruction = document.createElement('div');
      instruction.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        z-index: 10000;
        font-size: 24px;
        font-weight: bold;
        border: 3px solid var(--btn-play);
      `;
      
      document.body.appendChild(instruction);
      
      const interval = setInterval(() => {
        const pitch = detector.detectPitch();
        
        if (countdown > 0) {
          instruction.textContent = `Sing your LOWEST comfortable note\n${countdown}`;
          countdown--;
        } else if (samples.length < 20) {
          instruction.textContent = `Keep singing... ${20 - samples.length}`;
          if (pitch && pitch.midi >= 36 && pitch.midi <= 60) {
            samples.push(pitch.midi);
          }
        } else {
          clearInterval(interval);
          document.body.removeChild(instruction);
          
          if (samples.length > 0) {
            // Take median of collected samples
            samples.sort((a, b) => a - b);
            const median = samples[Math.floor(samples.length / 2)];
            resolve(median);
          } else {
            reject(new Error('No pitch detected. Please try again.'));
          }
        }
      }, 100);
    });

    // Short break
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Collect high note
    const highNote = await new Promise<number>((resolve, reject) => {
      const samples: number[] = [];
      let countdown = 3;
      
      const instruction = document.createElement('div');
      instruction.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        z-index: 10000;
        font-size: 24px;
        font-weight: bold;
        border: 3px solid var(--btn-play);
      `;
      
      document.body.appendChild(instruction);
      
      const interval = setInterval(() => {
        const pitch = detector.detectPitch();
        
        if (countdown > 0) {
          instruction.textContent = `Sing your HIGHEST comfortable note\n${countdown}`;
          countdown--;
        } else if (samples.length < 20) {
          instruction.textContent = `Keep singing... ${20 - samples.length}`;
          if (pitch && pitch.midi >= 48 && pitch.midi <= 84) {
            samples.push(pitch.midi);
          }
        } else {
          clearInterval(interval);
          document.body.removeChild(instruction);
          
          if (samples.length > 0) {
            samples.sort((a, b) => a - b);
            const median = samples[Math.floor(samples.length / 2)];
            resolve(median);
          } else {
            reject(new Error('No pitch detected. Please try again.'));
          }
        }
      }, 100);
    });

    detector.cleanup();

    // Add a small buffer (2 semitones) on each end for comfort
    return {
      min: Math.max(36, lowNote - 2),
      max: Math.min(72, highNote + 2)
    };

  } catch (error) {
    detector.cleanup();
    throw error;
  }
}