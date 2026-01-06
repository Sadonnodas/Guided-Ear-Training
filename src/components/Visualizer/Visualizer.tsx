import { getDegreeLabelFromStep, getAvailableDegrees } from '../../audio/MusicTheory';
import type { ScaleDegree, ScaleType } from '../../types';
import './Visualizer.css';

const CELL_WIDTH = 60; 
const TAPE_RANGE = 24; 

interface VisualizerProps {
  viewMode: 'tape' | 'static';
  activeMidi: number | null;
  lastValidStep: number;
  enabledDegrees: ScaleDegree[];
  toggleDegree: (d: ScaleDegree) => void;
  // NEW: Need scaleType to know which degrees to show
  scaleType: ScaleType; 
}

export default function Visualizer({ 
  viewMode, activeMidi, lastValidStep, enabledDegrees, toggleDegree, scaleType
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
                // Pass scaleType so the tape knows if step 2 is a '3' (Major) or 'b3' (Minor)
                const label = getDegreeLabelFromStep(stepIndex, scaleType);
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
    // FIX: Get degrees dynamically based on the selected Scale Type (Major vs Minor)
    // This ensures we see "1, 2, b3..." instead of always "1, 2, 3..."
    const degrees = getAvailableDegrees(scaleType);

    return (
        <div className="static-container">
            {degrees.map(d => {
                const isEnabled = enabledDegrees.includes(d);
                // Compare labels using the current scale context
                const isActive = activeMidi !== null && getDegreeLabelFromStep(lastValidStep, scaleType) === d;
                
                return (
                    <div 
                        key={d}
                        // The class d-{label} triggers the specific color defined in CSS
                        className={`tape-cell d-${d} ${isActive ? 'active' : ''} ${isEnabled ? '' : 'disabled'}`}
                        onClick={() => toggleDegree(d)}
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