import { getAvailableDegrees } from '../../audio/MusicTheory';
import { useLongPress } from '../../hooks/useLongPress';
import type { ScaleDegree, ScaleType } from '../../types';
import type { ChordInfo } from '../../core/ChordProgressionGenerator';
import './Visualizer.css';

const CELL_WIDTH = 60;
const TAPE_RANGE = 24; // How many cells extend in each direction

// Chord cell component with long-press support (same as Random tab)
interface ChordCellProps {
  degree: ScaleDegree;
  romanNumeral: string;
  isActive: boolean;
  isEnabled: boolean;
  isFocused: boolean;
  onToggle: (d: ScaleDegree) => void;
  onFocus: (d: ScaleDegree) => void;
  chord?: ChordInfo;
  cellKey: string | number;
}

const ChordCell = ({
  degree,
  romanNumeral,
  isActive,
  isEnabled,
  isFocused,
  onToggle,
  onFocus,
  chord,
  cellKey
}: ChordCellProps) => {
  const { isLongPressing, ...handlers } = useLongPress({
    onClick: () => onToggle(degree),
    onLongPress: () => onFocus(degree),
    ms: 600,
    debug: false
  });

  let classes = `tape-cell d-${degree}`;
  if (isActive) classes += ' active';
  if (isFocused) classes += ' focused';
  if (!isEnabled && !isFocused) classes += ' disabled';
  if (isLongPressing) classes += ' pressing';

  return (
    <div 
      key={cellKey}
      className={classes}
      {...handlers}
      title={chord 
        ? `${chord.roman} chord - ${chord.quality}${chord.seventh ? ' 7th' : ''}\nClick to ${isEnabled ? 'disable' : 'enable'} | Long-press (600ms) to focus` 
        : `${romanNumeral}\nClick to ${isEnabled ? 'disable' : 'enable'} | Long-press (600ms) to focus`
      }
      style={{ cursor: 'pointer' }}
    >
      <span style={{ pointerEvents: 'none' }}>
        {romanNumeral}
      </span>
    </div>
  );
};

// Map degrees to roman numerals for each scale type
const MAJOR_DEGREE_TO_ROMAN: Record<ScaleDegree, string> = {
  "1": "I", "2": "ii", "3": "iii", "4": "IV", 
  "5": "V", "6": "vi", "7": "vii°",
  "b2": "♭II", "b3": "♭III", "#4": "♯IV", "b6": "♭VI", "b7": "♭VII"
};

const MINOR_DEGREE_TO_ROMAN: Record<ScaleDegree, string> = {
  "1": "i", "2": "ii°", "b3": "♭III", "4": "iv",
  "5": "v", "b6": "♭VI", "b7": "♭VII",
  "b2": "♭II", "3": "III", "#4": "♯IV", "6": "VI", "7": "VII"
};

interface ProgressionsVisualizerProps {
  chords: ChordInfo[];
  activeChordIndex: number | null;
  activeRootMidi: number | null;
  hideVisuals: boolean;
  status: string;
  viewMode: 'tape' | 'static';
  scaleType: ScaleType;
  currentKey: string;
  keyRootMidi: number;
  enabledDegrees: ScaleDegree[];
  toggleDegree: (d: ScaleDegree) => void;
  focusedDegrees: ScaleDegree[];
  toggleFocus: (d: ScaleDegree) => void;
}

export default function ProgressionsVisualizer({
  chords,
  activeChordIndex,
  activeRootMidi,
  hideVisuals,
  status,
  viewMode,
  scaleType,
  keyRootMidi,
  enabledDegrees,
  toggleDegree,
  focusedDegrees,
  toggleFocus
}: ProgressionsVisualizerProps) {
  
  // Get all available degrees for this scale type
  const allDegrees = getAvailableDegrees(scaleType);
  
  // Get roman numeral map based on scale type
  const degreeToRomanMap = scaleType === 'Minor' ? MINOR_DEGREE_TO_ROMAN : MAJOR_DEGREE_TO_ROMAN;
  
  // Create a map of degree to chord info
  const degreeToChord = new Map<ScaleDegree, ChordInfo>();
  chords.forEach(chord => {
    degreeToChord.set(chord.degree, chord);
  });
  
  // Determine if we should hide the ACTIVE highlighting (blind mode during Listen passes)
  // When hidden, the visualizer doesn't move or highlight - it stays static
  const shouldHideActive = hideVisuals && (status === "Listen" || status === "Listen (Again)");
  
  // Get the currently active chord (but don't show it if in blind mode OR if status is empty/settling)
  const activeChord = activeChordIndex !== null ? chords[activeChordIndex] : null;
  const isValidStatus = status && status !== "Paused" && status !== "Settling In..." && status !== "";
  const displayActiveChord = (shouldHideActive || !isValidStatus) ? null : activeChord;
  
  // Render tape view (infinite scrolling - adjacent scale degrees, positioned by MIDI)
  const renderTape = () => {
    // Create cells for scale steps (like Random mode - no gaps!)
    const staticCells = Array.from(
      { length: (TAPE_RANGE * 2) + 1 }, 
      (_, i) => i - TAPE_RANGE
    );
    
    // Map scale step indices to semitone offsets
    // In Major: step 0=0, 1=2, 2=4, 3=5, 4=7, 5=9, 6=11 semitones
    // In Minor: step 0=0, 1=2, 2=3, 3=5, 4=7, 5=8, 6=10 semitones
    const stepToSemitones = (step: number): number => {
      const stepsInOctave = allDegrees.length;
      const octave = Math.floor(step / stepsInOctave);
      const degreeIndex = ((step % stepsInOctave) + stepsInOctave) % stepsInOctave;
      
      const degreeToSemitones: Partial<Record<ScaleDegree, number>> = scaleType === 'Minor' 
        ? { "1": 0, "2": 2, "b3": 3, "4": 5, "5": 7, "b6": 8, "b7": 10 }
        : { "1": 0, "2": 2, "3": 4, "4": 5, "5": 7, "6": 9, "7": 11 };
      
      const degree = allDegrees[degreeIndex];
      const baseSemitones = degreeToSemitones[degree] || 0;
      
      return baseSemitones + (octave * 12);
    };
    
    // Find which scale step corresponds to the active MIDI position
    // Use displayActiveChord (null when hidden) instead of activeChord
    let activeScaleStep = 0;
    if (activeRootMidi !== null && displayActiveChord !== null) {
      const targetSemitones = activeRootMidi - keyRootMidi;
      // Find the scale step that matches this semitone offset
      for (let step = -50; step <= 50; step++) {
        if (stepToSemitones(step) === targetSemitones) {
          activeScaleStep = step;
          break;
        }
      }
    }
    
    // Calculate offset to center the active scale step (like Random mode)
    // When hidden, activeScaleStep stays at 0, so visualizer doesn't move
    const initialOffset = (TAPE_RANGE * CELL_WIDTH) + (CELL_WIDTH / 2);
    const dynamicOffset = activeScaleStep * CELL_WIDTH;
    const totalTranslate = -(initialOffset + dynamicOffset);
    
    return (
      <div 
        className="tape-strip" 
        style={{ 
          transform: `translateX(${totalTranslate}px)`,
          transition: 'transform 0.3s ease-out'
        }}
      >
        {staticCells.map((scaleStep) => {
          const stepsInOctave = allDegrees.length;
          const degreeIndex = ((scaleStep % stepsInOctave) + stepsInOctave) % stepsInOctave;
          const degree = allDegrees[degreeIndex];
          const chord = degreeToChord.get(degree);
          
          // Check if this scale step is active (using displayActiveChord, which is null when hidden)
          const isActive = scaleStep === activeScaleStep && displayActiveChord !== null;
          const isEnabled = enabledDegrees.includes(degree);
          const isFocused = focusedDegrees.includes(degree);
          
          // Always show roman numeral (never show question marks)
          const romanNumeral = chord?.roman || degreeToRomanMap[degree] || degree;
          
          return (
            <ChordCell
              key={scaleStep}
              degree={degree}
              romanNumeral={romanNumeral}
              isActive={isActive}
              isEnabled={isEnabled}
              isFocused={isFocused}
              onToggle={toggleDegree}
              onFocus={toggleFocus}
              chord={chord}
              cellKey={scaleStep}
            />
          );
        })}
      </div>
    );
  };
  
  // Render static view (grid - all degrees visible)
  const renderStatic = () => {
    return (
      <div className="static-container">
        {allDegrees.map(degree => {
          const chord = degreeToChord.get(degree);
          // Use displayActiveChord (null when hidden) instead of activeChord
          const isActive = displayActiveChord?.degree === degree;
          const isEnabled = enabledDegrees.includes(degree);
          const isFocused = focusedDegrees.includes(degree);
          
          // Always show roman numeral (never show question marks)
          const romanNumeral = chord?.roman || degreeToRomanMap[degree] || degree;
          
          return (
            <ChordCell
              key={degree}
              degree={degree}
              romanNumeral={romanNumeral}
              isActive={isActive}
              isEnabled={isEnabled}
              isFocused={isFocused}
              onToggle={toggleDegree}
              onFocus={toggleFocus}
              chord={chord}
              cellKey={degree}
            />
          );
        })}
      </div>
    );
  };
  
  return (
    <div className={`visualizer-container ${viewMode}`}>
      {viewMode === 'tape' ? renderTape() : renderStatic()}
    </div>
  );
}