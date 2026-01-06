import { getDegreeLabelFromStep, getAvailableDegrees } from '../../audio/MusicTheory';
import { useLongPress } from '../../hooks/useLongPress'; // Import Hook
import type { ScaleDegree, ScaleType } from '../../types';
import './Visualizer.css';

const CELL_WIDTH = 60; 
const TAPE_RANGE = 24; 

interface VisualizerProps {
  viewMode: 'tape' | 'static';
  activeMidi: number | null;
  lastValidStep: number;
  enabledDegrees: ScaleDegree[];
  focusedDegrees: ScaleDegree[]; 
  toggleDegree: (d: ScaleDegree) => void;
  toggleFocus: (d: ScaleDegree) => void; // Add this prop
  scaleType: ScaleType; 
}

// Sub-component for individual notes to handle hooks cleanly
const NoteCell = ({ label, isActive, isEnabled, isFocused, onToggle, onFocus }: any) => {
    
    // Wire up the hook
    const handlers = useLongPress({
        onClick: () => onToggle(label),
        onLongPress: () => onFocus(label),
        ms: 400 // 400ms hold time
    });

    let classes = `tape-cell d-${label}`;
    if (isActive) classes += ' active';
    if (isFocused) classes += ' focused';
    if (!isEnabled && !isFocused) classes += ' disabled';

    return (
        <div 
            className={classes}
            {...handlers} // Apply mouse/touch handlers
        >
            <span>{label}</span>
        </div>
    );
};

export default function Visualizer({ 
  viewMode, activeMidi, lastValidStep, enabledDegrees, focusedDegrees, toggleDegree, toggleFocus, scaleType
}: VisualizerProps) {

  // --- Tape Logic ---
  const renderTape = () => {
    const staticCells = Array.from({length: (TAPE_RANGE * 2) + 1}, (_, i) => i - TAPE_RANGE);
    const initialOffset = (TAPE_RANGE * CELL_WIDTH) + (CELL_WIDTH / 2);
    const dynamicOffset = lastValidStep * CELL_WIDTH;
    const totalTranslate = -(initialOffset + dynamicOffset);

    return (
        <div className="tape-strip" style={{ transform: `translateX(${totalTranslate}px)` }}>
            {staticCells.map((stepIndex) => {
                const label = getDegreeLabelFromStep(stepIndex, scaleType) as ScaleDegree;
                const isActive = stepIndex === lastValidStep && activeMidi !== null;
                const isEnabled = enabledDegrees.includes(label);
                const isFocused = focusedDegrees.includes(label);
                
                return (
                    <NoteCell 
                        key={stepIndex}
                        label={label}
                        isActive={isActive}
                        isEnabled={isEnabled}
                        isFocused={isFocused}
                        onToggle={toggleDegree}
                        onFocus={toggleFocus}
                    />
                );
            })}
        </div>
    );
  };

  // --- Static Logic ---
  const renderStatic = () => {
    const degrees = getAvailableDegrees(scaleType);

    return (
        <div className="static-container">
            {degrees.map(d => {
                const isActive = activeMidi !== null && getDegreeLabelFromStep(lastValidStep, scaleType) === d;
                const isEnabled = enabledDegrees.includes(d);
                const isFocused = focusedDegrees.includes(d);

                return (
                    <NoteCell 
                        key={d}
                        label={d}
                        isActive={isActive}
                        isEnabled={isEnabled}
                        isFocused={isFocused}
                        onToggle={toggleDegree}
                        onFocus={toggleFocus}
                    />
                )
            })}
        </div>
    )
  };

  return (
    <div className={`visualizer-container ${viewMode}`}>
        {viewMode === 'tape' ? renderTape() : renderStatic()}
    </div>
  );
}