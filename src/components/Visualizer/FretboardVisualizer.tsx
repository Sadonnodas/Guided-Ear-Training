import { getFretboardConfig } from '../../config/FretboardData';
import type { CagedShape } from '../../config/FretboardData'; 
import type { MusicalKey, ScaleType } from '../../types';
import './Visualizer.css';

interface FretboardVisualizerProps {
  currentKey: MusicalKey;
  scaleType: ScaleType;
  selectedShape: CagedShape;
  activeMidi: number | null;
  hideVisuals: boolean;
}

export default function FretboardVisualizer({
  currentKey, scaleType, selectedShape, activeMidi, hideVisuals
}: FretboardVisualizerProps) {

  const config = getFretboardConfig(currentKey, scaleType, selectedShape);
  
  // Dimensions
  const fretCount = config.endFret - config.startFret + 1;
  const viewWidth = 900;  
  const viewHeight = 480; // Vertically larger for a clearer view
  const paddingX = 40;    // Padding on sides
  const fretWidth = (viewWidth - (paddingX * 2)) / fretCount;
  
  // String Spacing (centered vertically)
  const neckTopY = 80; // Pushed down slightly for larger circles
  const neckBottomY = viewHeight - 120; // Pulled up slightly
  const neckHeight = neckBottomY - neckTopY;
  const stringSpacing = neckHeight / 5; // 5 spaces for 6 strings

  // --- HELPERS ---

  // X = Center of the space between frets
  const getNoteX = (fret: number) => {
      const localFret = fret - config.startFret;
      return paddingX + (localFret * fretWidth) - (fretWidth / 2);
  };

  // X = Position of the Fret Wire itself
  const getWireX = (i: number) => paddingX + (i * fretWidth);

  // Y = String Height (1 = High E, 6 = Low E)
  const getStringY = (stringNum: number) => {
      return neckTopY + ((stringNum - 1) * stringSpacing);
  };

  const getDegreeColor = (d: string) => {
     if(d==='1') return 'var(--c-1)';
     if(d==='2' || d==='9') return 'var(--c-2)';
     if(d==='3' || d==='b3') return 'var(--c-3)';
     if(d==='4' || d==='11') return 'var(--c-4)';
     if(d==='5') return 'var(--c-5)';
     if(d==='6' || d==='13' || d==='b6') return 'var(--c-6)';
     if(d==='7' || d==='b7') return 'var(--c-7)';
     return 'var(--text-muted)';
  };

  const renderInlays = () => {
      const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21];
      return inlays.map(f => {
          if (f < config.startFret || f > config.endFret) return null;
          const x = getNoteX(f);
          
          if (f % 12 === 0 && f !== 0) {
             return (
                 <g key={f}>
                     <circle cx={x} cy={neckTopY - 15} r={6} fill="rgba(255,255,255,0.15)" />
                     <circle cx={x} cy={neckBottomY + 15} r={6} fill="rgba(255,255,255,0.15)" />
                 </g>
             );
          }
          return <circle key={f} cx={x} cy={(neckTopY + neckBottomY) / 2} r={8} fill="rgba(255,255,255,0.1)" />;
      });
  };

  return (
    <div className="visualizer-container" style={{
        height: '320px', 
        overflow: 'hidden', 
        display:'flex', 
        justifyContent:'center',
        background: 'transparent'
    }}>
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} style={{width:'100%', maxWidth:'800px'}}>
            
            {/* Inlays */}
            {renderInlays()}

            {/* Fret Wires */}
            {Array.from({length: fretCount + 1}).map((_, i) => (
                <line 
                    key={`wire-${i}`} 
                    x1={getWireX(i)} y1={neckTopY} 
                    x2={getWireX(i)} y2={neckBottomY} 
                    stroke="#555" 
                    strokeWidth={3} 
                />
            ))}

            {/* Strings */}
            {Array.from({length: 6}).map((_, i) => {
                const stringNum = i + 1;
                const thickness = 1 + (stringNum * 0.6); 
                const y = getStringY(stringNum);
                return (
                    <line 
                        key={`str-${i}`} 
                        x1={paddingX - 10} y1={y} 
                        x2={viewWidth - paddingX + 10} y2={y} 
                        stroke="rgba(255,255,255,0.4)" 
                        strokeWidth={thickness} 
                    />
                );
            })}

            {/* Fret Numbers */}
            {Array.from({length: fretCount}).map((_, i) => {
                const f = config.startFret + i;
                if ([3,5,7,9,12,15,17].includes(f)) 
                    return (
                        <text 
                            key={`num-${i}`} 
                            x={getNoteX(f)} 
                            y={neckBottomY + 35} 
                            fill="#666" 
                            fontSize="14" 
                            textAnchor="middle" 
                            fontWeight="bold"
                        >
                            {f}
                        </text>
                    );
                return null;
            })}

            {/* Notes */}
            {config.notes.map((note, idx) => {
                const isActive = activeMidi === note.midi;
                const displayActive = isActive && !hideVisuals;
                const noteColor = getDegreeColor(note.degree);
                
                const cx = getNoteX(note.fret);
                const cy = getStringY(note.string);
                const r = 24; // Matches standard visualizer circle size

                return (
                    <g key={`note-${idx}`}>
                        <circle 
                            cx={cx} cy={cy} r={r}
                            fill={displayActive ? noteColor : "transparent"}
                            stroke={displayActive ? "white" : "rgba(255,255,255,0.15)"}
                            strokeWidth={displayActive ? 4 : 2} // Slightly thicker stroke for better legibility
                            style={{transition: 'all 0.15s ease-out'}}
                        />
                        <text 
                            x={cx} y={cy} dy="6" // Adjusted dy for larger font
                            textAnchor="middle" 
                            fill="#161b22"
                            fontWeight="800" 
                            fontSize="18" // Larger font for better readability
                            opacity={displayActive ? 1 : 0}
                            style={{pointerEvents:'none'}}
                        >
                            {note.degree}
                        </text>
                    </g>
                )
            })}
        </svg>
    </div>
  );
}