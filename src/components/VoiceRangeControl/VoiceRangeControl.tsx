import { useState } from 'react';
import * as Tone from 'tone';
import './VoiceRangeControl.css';

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <path d="M12 19v4"/>
    <path d="M8 23h8"/>
  </svg>
);

interface VoiceRangeControlProps {
  minMidi: number;
  maxMidi: number;
  onRangeChange: (min: number, max: number) => void;
  onAutoCalibrate?: () => Promise<{min: number, max: number}>;
}

const MIDI_TO_NOTE: Record<number, string> = {
  36: 'C2', 37: 'C♯2', 38: 'D2', 39: 'E♭2', 40: 'E2', 41: 'F2', 42: 'F♯2', 43: 'G2',
  44: 'G♯2', 45: 'A2', 46: 'B♭2', 47: 'B2', 48: 'C3', 49: 'C♯3', 50: 'D3', 51: 'E♭3',
  52: 'E3', 53: 'F3', 54: 'F♯3', 55: 'G3', 56: 'G♯3', 57: 'A3', 58: 'B♭3', 59: 'B3',
  60: 'C4', 61: 'C♯4', 62: 'D4', 63: 'E♭4', 64: 'E4', 65: 'F4', 66: 'F♯4', 67: 'G4',
  68: 'G♯4', 69: 'A4', 70: 'B♭4', 71: 'B4', 72: 'C5'
};

const ABSOLUTE_MIN = 36; // C2
const ABSOLUTE_MAX = 72; // C5

export default function VoiceRangeControl({ 
  minMidi, 
  maxMidi, 
  onRangeChange,
  onAutoCalibrate 
}: VoiceRangeControlProps) {
  
  const [isPlaying, setIsPlaying] = useState<'low' | 'high' | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  /**
   * FIXED: Use Tone.js instead of separate AudioContext
   * This ensures audio works immediately on iOS
   */
  const playPreview = async (midi: number, type: 'low' | 'high') => {
    try {
      // Ensure Tone.js is started (required for iOS)
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      // Use Tone.js synth for preview
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.3,
          release: 0.5
        }
      }).toDestination();

      const freq = midiToFreq(midi);
      const now = Tone.now();
      
      setIsPlaying(type);
      
      // Play note for 1 second
      synth.triggerAttackRelease(freq, 1, now);
      
      // Clean up synth after playing
      setTimeout(() => {
        synth.dispose();
        setIsPlaying(null);
      }, 1100);

    } catch (error) {
      console.error('Preview playback failed:', error);
      setIsPlaying(null);
    }
  };

  const handleCalibrate = async () => {
    if (!onAutoCalibrate) return;
    setIsCalibrating(true);
    try {
      const result = await onAutoCalibrate();
      onRangeChange(result.min, result.max);
    } catch (e) {
      console.error('Calibration failed:', e);
      alert('Calibration failed. Please check microphone permissions.');
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value);
    if (newMin < maxMidi) {
      onRangeChange(newMin, maxMidi);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value);
    if (newMax > minMidi) {
      onRangeChange(minMidi, newMax);
    }
  };

  return (
    <div className="voice-range-control">
      <div className="control-section">
        <label className="control-label">Vocal Range</label>
        
        <div className="range-group">
          {/* LOW RANGE */}
          <div className="range-item">
            <div className="range-header">
              <span className="range-label">Low</span>
              <button 
                className={`preview-btn ${isPlaying === 'low' ? 'playing' : ''}`}
                onClick={() => playPreview(minMidi, 'low')}
                disabled={isPlaying !== null}
                title="Preview lowest note"
              >
                <PlayIcon />
              </button>
            </div>
            <input 
              type="range" 
              min={ABSOLUTE_MIN} 
              max={ABSOLUTE_MAX} 
              value={minMidi}
              onChange={handleMinChange}
              className="range-slider"
            />
            <div className="range-value">{MIDI_TO_NOTE[minMidi]}</div>
          </div>

          {/* HIGH RANGE */}
          <div className="range-item">
            <div className="range-header">
              <span className="range-label">High</span>
              <button 
                className={`preview-btn ${isPlaying === 'high' ? 'playing' : ''}`}
                onClick={() => playPreview(maxMidi, 'high')}
                disabled={isPlaying !== null}
                title="Preview highest note"
              >
                <PlayIcon />
              </button>
            </div>
            <input 
              type="range" 
              min={ABSOLUTE_MIN} 
              max={ABSOLUTE_MAX} 
              value={maxMidi}
              onChange={handleMaxChange}
              className="range-slider"
            />
            <div className="range-value">{MIDI_TO_NOTE[maxMidi]}</div>
          </div>
        </div>

        {onAutoCalibrate && (
          <button 
            className={`calibrate-btn ${isCalibrating ? 'calibrating' : ''}`}
            onClick={handleCalibrate}
            disabled={isCalibrating}
          >
            <MicIcon />
            <span>{isCalibrating ? 'Listening...' : 'Auto-Calibrate'}</span>
          </button>
        )}
        
        <p className="range-hint">
          Adjust these sliders to match your comfortable singing range. 
          Click the play buttons to preview each note.
        </p>
      </div>
    </div>
  );
}