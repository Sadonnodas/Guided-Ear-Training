import { getDegreeLabelFromStep } from '../../audio/MusicTheory';
import type { ScaleDegree } from '../../types';
import './Visualizer.css';

const CELL_WIDTH = 60; 
const TAPE_RANGE = 24; 

interface VisualizerProps {
  viewMode: 'tape' | 'static';
  activeMidi: number | null;
  lastValidStep: number;
  enabledDegrees: ScaleDegree[];
  toggleDegree: (d: ScaleDegree) => void;
}

export default function Visualizer({ 
  viewMode, activeMidi, lastValidStep, enabledDegrees, toggleDegree 
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
                const label = getDegreeLabelFromStep(stepIndex, "Major");
                const isActive = stepIndex === lastValidStep && activeMidi !== null;
                const isEnabled = enabledDegrees.includes(label as ScaleDegree);
                
                return (
                    <div 
                        key={stepIndex} 
                        className={`tape-cell d-${label} ${isActive ? 'active' : ''} ${isEnabled ? '' : 'disabled'}`}
                        onClick={() => toggleDegree(label as ScaleDegree)}
                    >
                        <span>{label}</span>
                    </div>
                );
            })}
        </div>
    );
  };

  // --- Static Logic ---
  const renderStatic = () => {
    const degrees: ScaleDegree[] = ["1", "2", "3", "4", "5", "6", "7"];
    return (
        <div className="static-container">
            {degrees.map(d => {
                const isEnabled = enabledDegrees.includes(d);
                const isActive = activeMidi !== null && getDegreeLabelFromStep(lastValidStep, "Major") === d;
                
                return (
                    <div 
                        key={d}
                        className={`tape-cell d-${d} ${isActive ? 'active' : ''} ${isEnabled ? '' : 'disabled'}`}
                        onClick={() => toggleDegree(d)}
                        // FIX: Removed inline style to allow CSS responsive sizing
                    >
                        <span>{d}</span>
                    </div>
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