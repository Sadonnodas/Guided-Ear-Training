import React from 'react';
import type { ScaleDegree } from '../types'; // Added 'type' keyword

interface FretboardDiagramProps {
  startFret: number;
  endFret: number;
  activeNotes: Array<{ string: number; fret: number; degree: ScaleDegree }>;
  ghostNotes: Array<{ string: number; fret: number; degree: ScaleDegree }>;
  showLabels: boolean;
}

const FretboardDiagram: React.FC<FretboardDiagramProps> = ({ 
  startFret, endFret, activeNotes, ghostNotes, showLabels 
}) => {
  const strings = [1, 2, 3, 4, 5, 6];
  const frets = Array.from({ length: endFret - startFret + 1 }, (_, i) => startFret + i);

  // Helper to find if a note is currently "active" (lighting up)
  const getActiveNote = (s: number, f: number) => 
    activeNotes.find(n => n.string === s && n.fret === f);

  const getGhostNote = (s: number, f: number) => 
    ghostNotes.find(n => n.string === s && n.fret === f);

  return (
    <div className="fretboard-container" style={{ 
      position: 'relative', 
      padding: '40px 20px',
      background: '#1a1a1c',
      borderRadius: '8px',
      overflow: 'hidden',
      maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' 
    }}>
      {/* Strings */}
      {strings.map(s => (
        <div key={s} style={{
          height: `${s * 0.5 + 1}px`, // Thicker strings for low E
          background: 'goldenrod',
          width: '100%',
          margin: '25px 0',
          opacity: 0.6
        }} />
      ))}

      {/* Frets */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
        {frets.map(f => (
          <div key={f} style={{
            flex: 1,
            borderRight: '2px solid #444',
            position: 'relative'
          }}>
            <span style={{ position: 'absolute', bottom: 5, right: 5, fontSize: '10px', color: '#666' }}>{f}</span>
            
            {/* Dots for 3, 5, 7, 9, 12 */}
            {[3, 5, 7, 9, 12].includes(f) && (
               <div style={{ 
                 position: 'absolute', top: '50%', left: '100%', transform: 'translate(-50%, -50%)',
                 width: 10, height: 10, background: '#333', borderRadius: '50%' 
               }} />
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {frets.map((f, fIdx) => (
        strings.map(s => {
          const active = getActiveNote(s, f);
          const ghost = getGhostNote(s, f);
          if (!ghost) return null;

          return (
            <div key={`${s}-${f}`} style={{
              position: 'absolute',
              // Simple calculation for placement on the grid
              left: `${(fIdx + 0.5) * (100 / frets.length)}%`,
              top: `${(s - 1) * 19.5 + 10}%`, 
              transform: 'translate(-50%, -50%)',
              width: 30, height: 30,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.1)',
              backgroundColor: active ? 'var(--degree-color-' + active.degree + ')' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}>
              {(active || showLabels) && (
                <span style={{ fontWeight: 'bold', color: 'white' }}>{ghost.degree}</span>
              )}
            </div>
          );
        })
      ))}
    </div>
  );
};

export default FretboardDiagram;