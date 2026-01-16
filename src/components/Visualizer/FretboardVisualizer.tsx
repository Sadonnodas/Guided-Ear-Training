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
  status: string;
}

export default function FretboardVisualizer({
  currentKey, scaleType, selectedShape, activeMidi, hideVisuals, status
}: FretboardVisualizerProps) {

  const isRevealStage = status === "Answer" || status === "Affirm";
  const effectiveHide = hideVisuals && !isRevealStage;
  const config = getFretboardConfig(currentKey, scaleType, selectedShape);
  
  // Calculate actual fret range from notes (min to max fret used)
  const noteFrets = config.notes.map(n => n.fret);
  const minNoteFret = Math.min(...noteFrets);
  const maxNoteFret = Math.max(...noteFrets);
  
  // Add 1 fret padding on each side
  const displayStartFret = minNoteFret - 1;
  const displayEndFret = maxNoteFret + 1;
  const fretCount = displayEndFret - displayStartFret + 1;
  
  const paddingX = 40;    
  const fretWidth = 180;  
  const viewWidth = (fretCount * fretWidth) + (paddingX * 2);
  const viewHeight = 700; 
  
  const neckTopY = 60;  // More space at top for fret numbers
  const neckBottomY = viewHeight - 80; // More space at bottom for fret numbers
  const neckHeight = neckBottomY - neckTopY;
  const stringSpacing = neckHeight / 5; // 5 spaces for 6 strings

  // --- HELPERS ---

  // X = Center of the space between frets
  const getNoteX = (fret: number) => {
      const localFret = fret - displayStartFret;
      return paddingX + (localFret * fretWidth) + (fretWidth / 2);
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
          if (f < displayStartFret || f > displayEndFret) return null;
          const x = getNoteX(f);
          
          if (f % 12 === 0 && f !== 0) {
             return (
                 <g key={f}>
                     <circle cx={x} cy={neckTopY + stringSpacing * 1} r={7} fill="rgba(255,255,255,0.15)" />
                     <circle cx={x} cy={neckTopY + stringSpacing * 4} r={7} fill="rgba(255,255,255,0.15)" />
                 </g>
             );
          }
          return <circle key={f} cx={x} cy={(neckTopY + neckBottomY) / 2} r={9} fill="rgba(255,255,255,0.1)" />;
      });
  };

  return (
    <div className="visualizer-container" style={{
        height: '380px', 
        overflow: 'hidden', 
        display:'flex', 
        justifyContent:'center',
        background: 'transparent'
    }}>
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} style={{width:'100%', height:'auto'}}>
            
            {/* Inlays */}
            {renderInlays()}

            {/* Fret Wires */}
            {Array.from({length: fretCount + 1}).map((_, i) => (
                <line 
                    key={`wire-${i}`} 
                    x1={getWireX(i)} y1={neckTopY} 
                    x2={getWireX(i)} y2={neckBottomY} 
                    stroke="#555" 
                    strokeWidth={4} 
                />
            ))}

            {/* Strings */}
            {Array.from({length: 6}).map((_, i) => {
                const stringNum = i + 1;
                const thickness = 1.5 + (stringNum * 0.7); 
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

            {/* Fret Numbers - BOTTOM (only standard positions) */}
            {Array.from({length: fretCount}).map((_, i) => {
                const f = displayStartFret + i;
                // Only show fret numbers for positions 3, 5, 7, 9, 12
                if (![3, 5, 7, 9, 12, 15, 17].includes(f)) return null;
                
                return (
                    <text 
                        key={`num-bottom-${i}`} 
                        x={getNoteX(f)} 
                        y={neckBottomY + 45} 
                        fill="#aaa" 
                        fontSize="24" 
                        textAnchor="middle" 
                        fontWeight="bold"
                    >
                        {f}
                    </text>
                );
            })}

            {/* Notes - EXTRA LARGE CIRCLES */}
            {config.notes.map((note, idx) => {
                const isActive = activeMidi === note.midi;
                const displayActive = isActive && !effectiveHide;
                const noteColor = getDegreeColor(note.degree);
                
                const cx = getNoteX(note.fret);
                const cy = getStringY(note.string);
                const r = 50; // Slightly reduced for better spacing

                return (
                    <g key={`note-${idx}`}>
                        <circle 
                            cx={cx} cy={cy} r={r}
                            fill={displayActive ? noteColor : "transparent"}
                            stroke={displayActive ? "white" : "rgba(255,255,255,0.2)"}
                            strokeWidth={displayActive ? 7 : 3.5}
                            style={{transition: 'all 0.15s ease-out'}}
                        />
                        <text 
                            x={cx} y={cy} dy="11" 
                            textAnchor="middle" 
                            fill="#161b22"
                            fontWeight="900" 
                            fontSize="36" 
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