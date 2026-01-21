/**
 * IMPROVED PitchDetector.ts
 * 
 * Key improvements for accuracy:
 * 1. Larger FFT (4096) - better low frequency detection
 * 2. Mode filtering - uses most common pitch instead of median
 * 3. Outlier rejection - ignores unreasonable pitches
 * 4. No buffer added - returns exact detected pitch
 * 5. 50 samples - more data for accuracy
 * 6. Higher correlation threshold (0.95)
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
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
    } catch (e) {
      throw new Error('Microphone access denied.');
    }

    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096; // Larger for better accuracy
    this.analyser.smoothingTimeConstant = 0.3;

    this.microphone = this.audioContext.createMediaStreamSource(this.stream);
    this.microphone.connect(this.analyser);

    this.bufferLength = this.analyser.fftSize;
    this.buffer = new Float32Array(this.bufferLength);
  }

  detectPitch(): PitchDetectionResult | null {
    if (!this.analyser) return null;

    this.analyser.getFloatTimeDomainData(this.buffer);

    const rms = Math.sqrt(
      this.buffer.reduce((sum, val) => sum + val * val, 0) / this.buffer.length
    );

    if (rms < 0.005) return null;

    const frequency = this.autoCorrelate(this.buffer, this.sampleRate);
    
    if (frequency === -1) return null;

    const midi = this.frequencyToMidi(frequency);

    return {
      frequency,
      midi: Math.round(midi),
      confidence: rms
    };
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    
    for (let i = 0; i < SIZE; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / SIZE);
    
    if (rms < 0.005) return -1;

    let last_offset = 0;
    for (let i = 1; i < 1000; i++) {
      if (buffer[i - 1] >= 0 && buffer[i] < 0) {
        last_offset = i;
        break;
      }
    }

    for (let offset = last_offset; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      
      correlation = 1 - correlation / MAX_SAMPLES;
      
      if (correlation > 0.95 && correlation > best_correlation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    }

    if (best_correlation > 0.9 && best_offset !== -1) {
      return sampleRate / best_offset;
    }

    return -1;
  }

  private frequencyToMidi(frequency: number): number {
    return 12 * Math.log2(frequency / 440) + 69;
  }

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

function calculateMode(samples: number[]): number {
  const rounded = samples.map(s => Math.round(s));
  const frequency: Record<number, number> = {};
  
  for (const val of rounded) {
    frequency[val] = (frequency[val] || 0) + 1;
  }
  
  let maxCount = 0;
  let mode = rounded[0];
  
  for (const [val, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count;
      mode = parseInt(val);
    }
  }
  
  return mode;
}

export async function calibrateVocalRange(): Promise<{ min: number; max: number }> {
  const detector = new PitchDetector();
  
  try {
    await detector.initialize();

    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 10000;`;

    const content = document.createElement('div');
    content.style.cssText = `background: #161b22; color: white; padding: 40px; border-radius: 16px; text-align: center; max-width: 400px; border: 3px solid var(--btn-play);`;

    const title = document.createElement('div');
    title.style.cssText = `font-size: 20px; font-weight: bold; margin-bottom: 20px; color: var(--btn-play);`;

    const instruction = document.createElement('div');
    instruction.style.cssText = `font-size: 18px; margin-bottom: 15px; min-height: 60px; white-space: pre-line;`;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 20px;`;

    const progressFill = document.createElement('div');
    progressFill.style.cssText = `height: 100%; background: var(--btn-play); width: 0%; transition: width 0.2s ease;`;
    progressBar.appendChild(progressFill);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `background: rgba(255,107,107,0.2); border: 1px solid #ff6b6b; color: #ff6b6b; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: 600;`;

    let cancelled = false;
    cancelBtn.onclick = () => { cancelled = true; };

    content.appendChild(title);
    content.appendChild(instruction);
    content.appendChild(progressBar);
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    const updateUI = (titleText: string, instrText: string, progress: number) => {
      title.textContent = titleText;
      instruction.textContent = instrText;
      progressFill.style.width = `${progress}%`;
    };

    const collectSamples = async (isLow: boolean): Promise<number> => {
      return new Promise((resolve, reject) => {
        const samples: number[] = [];
        let countdown = 3;
        const targetSamples = 50;
        const noteType = isLow ? 'LOWEST' : 'HIGHEST';
        const minMidi = isLow ? 36 : 48;
        const maxMidi = isLow ? 60 : 84;
        
        const interval = setInterval(() => {
          if (cancelled) {
            clearInterval(interval);
            reject(new Error('Cancelled'));
            return;
          }

          const pitch = detector.detectPitch();
          
          if (countdown > 0) {
            updateUI('🎵 Vocal Range Calibration', `Sing your ${noteType} comfortable note\n\nStarting in ${countdown}...`, 0);
            countdown--;
          } else if (samples.length < targetSamples) {
            const progress = (samples.length / targetSamples) * 100;
            updateUI('🎵 Vocal Range Calibration', `Keep singing your ${noteType} note...\n\nCollecting: ${samples.length}/${targetSamples}`, progress);
            
            if (pitch && pitch.midi >= minMidi && pitch.midi <= maxMidi) {
              samples.push(pitch.midi);
            }
          } else {
            clearInterval(interval);
            
            if (samples.length > 0) {
              const mode = calculateMode(samples);
              resolve(mode);
            } else {
              reject(new Error('No pitch detected'));
            }
          }
        }, 100);
      });
    };

    const lowNote = await collectSamples(true);
    updateUI('✓ Low note captured!', 'Preparing for high note...', 100);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const highNote = await collectSamples(false);
    updateUI('✓ Calibration Complete!', 'Your vocal range has been set.', 100);
    await new Promise(resolve => setTimeout(resolve, 1000));

    document.body.removeChild(modal);
    detector.cleanup();

    return {
      min: Math.max(36, lowNote),
      max: Math.min(72, highNote)
    };

  } catch (error) {
    detector.cleanup();
    const modal = document.querySelector('[style*="z-index: 10000"]');
    if (modal) document.body.removeChild(modal);
    throw error;
  }
}