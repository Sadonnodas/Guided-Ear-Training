import { useState, useRef } from 'react';
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

// FIX #1: Limit range to available vocal samples (G2 to G4)
const ABSOLUTE_MIN = 43; // G2 - lowest vocal sample
const ABSOLUTE_MAX = 67; // G4 - highest vocal sample

export default function VoiceRangeControl({ 
  minMidi, 
  maxMidi, 
  onRangeChange,
  onAutoCalibrate 
}: VoiceRangeControlProps) {
  
  const [isPlaying, setIsPlaying] = useState<'low' | 'high' | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  const playPreview = async (midi: number, type: 'low' | 'high') => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = midiToFreq(midi);
    
    // FIXED: Increased volume from 0.25 to 0.6 for much better audibility
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05); // Was 0.25, now 0.6
    gain.gain.setValueAtTime(0.6, ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    setIsPlaying(type);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);

    setTimeout(() => setIsPlaying(null), 1000);
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
    <div className="vocal-range-section">
      {/* Header */}
      <div className="vocal-range-header">
        <span className="vocal-range-title">Vocal Range</span>
        <button 
          className="auto-calibrate-btn" 
          onClick={handleCalibrate}
          disabled={isCalibrating}
          title="Auto-detect your range by singing your lowest and highest notes"
        >
          <MicIcon />
          <span>{isCalibrating ? 'Listening...' : 'Auto-Calibrate'}</span>
        </button>
      </div>

      {/* Range Display and Controls */}
      <div className="range-display-row">
        {/* Low Note */}
        <div className="note-control">
          <button 
            className={`note-preview-btn ${isPlaying === 'low' ? 'playing' : ''}`}
            onClick={() => playPreview(minMidi, 'low')}
            title={`Play lowest note (${MIDI_TO_NOTE[minMidi]})`}
          >
            <PlayIcon />
          </button>
          <span className="note-label">{MIDI_TO_NOTE[minMidi] || minMidi}</span>
        </div>

        {/* Slider Container */}
        <div className="dual-slider-wrapper">
          {/* Background track */}
          <div className="slider-track-bg" />
          
          {/* Active range fill */}
          <div 
            className="slider-range-fill"
            style={{
              left: `${((minMidi - ABSOLUTE_MIN) / (ABSOLUTE_MAX - ABSOLUTE_MIN)) * 100}%`,
              width: `${((maxMidi - minMidi) / (ABSOLUTE_MAX - ABSOLUTE_MIN)) * 100}%`
            }}
          />

          {/* Min slider */}
          <input
            type="range"
            className="range-slider min-slider"
            min={ABSOLUTE_MIN}
            max={ABSOLUTE_MAX}
            value={minMidi}
            onChange={handleMinChange}
            title="Drag to set lowest comfortable note"
          />

          {/* Max slider */}
          <input
            type="range"
            className="range-slider max-slider"
            min={ABSOLUTE_MIN}
            max={ABSOLUTE_MAX}
            value={maxMidi}
            onChange={handleMaxChange}
            title="Drag to set highest comfortable note"
          />
        </div>

        {/* High Note */}
        <div className="note-control">
          <span className="note-label">{MIDI_TO_NOTE[maxMidi] || maxMidi}</span>
          <button 
            className={`note-preview-btn ${isPlaying === 'high' ? 'playing' : ''}`}
            onClick={() => playPreview(maxMidi, 'high')}
            title={`Play highest note (${MIDI_TO_NOTE[maxMidi]})`}
          >
            <PlayIcon />
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="range-hint">
        Drag sliders to set range • Click buttons to preview notes • Range: G2-G4
      </div>
    </div>
  );
}