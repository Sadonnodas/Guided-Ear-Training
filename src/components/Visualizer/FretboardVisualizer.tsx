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
  
  // Determine if we should show the nut
  // Only show nut if we have notes very close to it (frets 0-2)
  const showNut = minNoteFret <= 2;
  
  // Start display at fret 0 (nut) if showing nut, otherwise pad by 1
  const displayStartFret = showNut ? 0 : Math.max(0, minNoteFret - 1);
  const displayEndFret = maxNoteFret + 1;
  
  // Calculate fret count
  // If showing nut: we need spaces for frets 1, 2, 3... (nut doesn't count as a space)
  // If not showing nut: count normally
  const fretCount = showNut 
    ? displayEndFret  // e.g., if endFret is 7, we need spaces for frets 1-7 = 7 spaces
    : displayEndFret - displayStartFret + 1;
  
  const paddingX = 40;    
  const fretWidth = 180;  
  const nutWidth = 12; // Width of the nut visual
  const viewWidth = (fretCount * fretWidth) + (paddingX * 2);
  const viewHeight = 700; 
  
  const neckTopY = 60;  // More space at top for fret numbers
  const neckBottomY = viewHeight - 80; // More space at bottom for fret numbers
  const neckHeight = neckBottomY - neckTopY;
  const stringSpacing = neckHeight / 5; // 5 spaces for 6 strings

  // --- HELPERS ---

  // X = Center of the space between frets (or ON the nut for fret 0)
  const getNoteX = (fret: number) => {
      // Special case: fret 0 notes appear ON the nut itself
      if (showNut && fret === 0) {
          return paddingX; // Position on the nut
      }
      
      // When showing nut, fret 1 is in the first space (between nut and first wire)
      if (showNut) {
          return paddingX + ((fret - 1) * fretWidth) + (fretWidth / 2);
      }
      
      // Normal calculation when not showing nut
      const localFret = fret - displayStartFret;
      return paddingX + (localFret * fretWidth) + (fretWidth / 2);
  };

  // X = Position of the Fret Wire itself
  const getWireX = (i: number) => {
      // When showing nut, fret wires start from fret 1 (first wire is at fret 1)
      // When not showing nut, normal calculation
      if (showNut) {
          return paddingX + (i * fretWidth); // i=0 → fret 1, i=1 → fret 2, etc.
      }
      return paddingX + (i * fretWidth);
  };

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

            {/* THE NUT - Only show when displayStartFret is 0 */}
            {showNut && (
                <g>
                    {/* Main nut body - thick white bar */}
                    <rect
                        x={paddingX - nutWidth / 2}
                        y={neckTopY - 10}
                        width={nutWidth}
                        height={neckHeight + 20}
                        fill="#e8e8e8"
                        stroke="#ccc"
                        strokeWidth={1}
                    />
                    
                    {/* String notches on the nut - small dark lines showing where strings sit */}
                    {Array.from({length: 6}).map((_, i) => {
                        const stringNum = i + 1;
                        const y = getStringY(stringNum);
                        return (
                            <line
                                key={`nut-notch-${i}`}
                                x1={paddingX - nutWidth / 2}
                                y1={y}
                                x2={paddingX + nutWidth / 2}
                                y2={y}
                                stroke="#333"
                                strokeWidth={1.5 + (stringNum * 0.3)}
                                opacity={0.6}
                            />
                        );
                    })}
                </g>
            )}

            {/* Fret Wires */}
            {Array.from({length: fretCount + 1}).map((_, i) => {
                // When showing nut, i=0 represents fret 1 wire, i=1 represents fret 2 wire, etc.
                // When not showing nut, normal behavior
                
                return (
                    <line 
                        key={`wire-${i}`} 
                        x1={getWireX(i)} y1={neckTopY} 
                        x2={getWireX(i)} y2={neckBottomY} 
                        stroke="#555" 
                        strokeWidth={4} 
                    />
                );
            })}

            {/* Strings */}
            {Array.from({length: 6}).map((_, i) => {
                const stringNum = i + 1;
                const thickness = 1.5 + (stringNum * 0.7); 
                const y = getStringY(stringNum);
                
                // When showing nut, start strings FROM the nut instead of before it
                const stringStartX = showNut ? paddingX : paddingX - 10;
                
                return (
                    <line 
                        key={`str-${i}`} 
                        x1={stringStartX} y1={y} 
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