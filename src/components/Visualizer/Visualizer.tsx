import { getDegreeLabelFromStep, getAvailableDegrees } from '../../audio/MusicTheory';
import { useLongPress } from '../../hooks/useLongPress';
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
  toggleFocus: (d: ScaleDegree) => void;
  scaleType: ScaleType; 
}

interface NoteCellProps {
  label: ScaleDegree;
  isActive: boolean;
  isEnabled: boolean;
  isFocused: boolean;
  onToggle: (d: ScaleDegree) => void;
  onFocus: (d: ScaleDegree) => void;
  extraClass?: string;
}

const NoteCell = ({ 
  label, 
  isActive, 
  isEnabled, 
  isFocused, 
  onToggle, 
  onFocus, 
  extraClass = '' 
}: NoteCellProps) => {
  const { isLongPressing, ...handlers } = useLongPress({
    onClick: () => onToggle(label),
    onLongPress: () => onFocus(label),
    ms: 350
  });

  let classes = `tape-cell d-${label} ${extraClass}`;
  if (isActive) classes += ' active';
  if (isFocused) classes += ' focused';
  if (!isEnabled && !isFocused) classes += ' disabled';
  if (isLongPressing) classes += ' pressing';

  return (
    <div className={classes} {...handlers}>
      <span>{label}</span>
    </div>
  );
};

export default function Visualizer({ 
  viewMode, 
  activeMidi, 
  lastValidStep, 
  enabledDegrees, 
  focusedDegrees, 
  toggleDegree, 
  toggleFocus, 
  scaleType
}: VisualizerProps) {

  // Helper to get cell props
  const getCellProps = (d: ScaleDegree) => ({
    isActive: activeMidi !== null && getDegreeLabelFromStep(lastValidStep, scaleType) === d,
    isEnabled: enabledDegrees.includes(d),
    isFocused: focusedDegrees.includes(d),
    onToggle: toggleDegree,
    onFocus: toggleFocus
  });

  // --- Tape View ---
  const renderTape = () => {
    const staticCells = Array.from(
      { length: (TAPE_RANGE * 2) + 1 }, 
      (_, i) => i - TAPE_RANGE
    );
    const initialOffset = (TAPE_RANGE * CELL_WIDTH) + (CELL_WIDTH / 2);
    const dynamicOffset = lastValidStep * CELL_WIDTH;
    const totalTranslate = -(initialOffset + dynamicOffset);

    return (
      <div 
        className="tape-strip" 
        style={{ transform: `translateX(${totalTranslate}px)` }}
      >
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

  // --- Static View ---
  const renderStatic = () => {
    if (scaleType === 'Chromatic') {
      const whites: ScaleDegree[] = ["1", "2", "3", "4", "5", "6", "7"];

      return (
        <div className="static-container chromatic-grid">
          <div className="piano-row top">
            <div className="spacer half"></div>
            <NoteCell label="b2" {...getCellProps("b2")} />
            <NoteCell label="b3" {...getCellProps("b3")} />
            <div className="spacer full"></div> 
            <NoteCell label="#4" {...getCellProps("#4")} /> 
            <NoteCell label="b6" {...getCellProps("b6")} />
            <NoteCell label="b7" {...getCellProps("b7")} />
            <div className="spacer half"></div>
          </div>
          <div className="piano-row bottom">
            {whites.map(d => (
              <NoteCell key={d} label={d} {...getCellProps(d)} />
            ))}
          </div>
        </div>
      );
    }

    // Default Linear (Major/Minor/Pentatonic)
    const degrees = getAvailableDegrees(scaleType);
    return (
      <div className="static-container">
        {degrees.map(d => (
          <NoteCell 
            key={d}
            label={d}
            {...getCellProps(d)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={`visualizer-container ${viewMode} ${scaleType.toLowerCase()}`}>
      {viewMode === 'tape' ? renderTape() : renderStatic()}
    </div>
  );
}