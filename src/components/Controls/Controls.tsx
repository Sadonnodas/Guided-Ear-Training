import { useState, useEffect } from 'react';
import { DRUM_PATTERNS } from '../../config/AudioConfig';
import type { MelodyDifficulty } from '../../types'; 
import './Controls.css';

// --- ICONS ---
const PlayIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>;
const StopIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>; 
const ChevronIcon = ({open}: {open: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}><path d="M6 9l6 6 6-6"/></svg>;
const MinusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>;
const TrainingWheelsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M12 2v6" /><path d="M12 16v6" /><path d="M2 12h6" /><path d="M16 12h6" /></svg>;

const TEMPOS = [60, 80, 100, 120, 150];

interface ControlsProps {
  isPlaying: boolean;
  isPaused: boolean; // Add this line
  onPlayToggle: () => void;
  onStop: () => void; 
  bpm: number; setBpm: (b: number) => void;
  triggerPulse: boolean; 
  startRoot: boolean; setStartRoot: (v: boolean) => void;
  endRoot: boolean; setEndRoot: (v: boolean) => void;
  silentPractice: boolean; setSilentPractice: (v: boolean) => void;
  trainingWheels: boolean; setTrainingWheels: (v: boolean) => void;
  inverseMode: boolean; setInverseMode: (v: boolean) => void; // Renamed
  questionsPerKey: number; setQuestionsPerKey: (n: number) => void;
  difficulty: MelodyDifficulty; 
  setDifficulty: (d: MelodyDifficulty) => void;
  
  // MIXER
  volMaster: number; setVolMaster: (v: number) => void;
  volVoice: number; setVolVoice: (v: number) => void;
  volDrone: number; setVolDrone: (v: number) => void;
  volGroove: number; setVolGroove: (v: number) => void;
  volMetronome: number; setVolMetronome: (v: number) => void;
  volTraining: number; setVolTraining: (v: number) => void;
  volReverb: number; setVolReverb: (v: number) => void;
  
  toggleMute: (type: string, val: number, setter: (v: number) => void) => void;
  currentPattern: string;
  setPattern: (name: string) => void;
  hideFretboardVisuals: boolean;
  setHideFretboardVisuals: (v: boolean) => void;
  activeTab: string;
}

export default function Controls(props: ControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [animate, setAnimate] = useState(false);

// Calculate duration of one beat: 60 / BPM
  // We use a slightly shorter duration (90% of a beat) to make it feel snappier
  const beatDuration = ((60 / props.bpm) * 0.9).toFixed(3);

  useEffect(() => {
    if (props.isPlaying) {
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 100); 
        return () => clearTimeout(timer);
    }
  }, [props.triggerPulse, props.isPlaying]);

  const adjustQuestions = (delta: number) => {
      const newVal = Math.max(1, Math.min(50, props.questionsPerKey + delta));
      props.setQuestionsPerKey(newVal);
  };

  return (
    <>
      <div className="play-btn-container">
    <button 
     className={`play-btn ${props.isPlaying ? 'playing' : ''} ${animate ? 'pulse-beat' : ''}`} 
      onClick={props.onPlayToggle}
     style={{ "--beat-dur": `${beatDuration}s` } as React.CSSProperties}
    >
      {props.isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>

    {/* Moved below the play button and updated condition to include isPaused */}
    <div className={`stop-mini-btn ${props.isPlaying || props.isPaused ? 'visible' : ''}`} onClick={props.onStop}>
       <StopIcon />
       <span className="mini-label">RESTART</span>
    </div>
</div>

      <div className="settings-trigger" onClick={() => setSettingsOpen(!settingsOpen)}>
        <span>Controls</span>
        <ChevronIcon open={settingsOpen} />
      </div>

      <div className={`controls-accordion ${settingsOpen ? 'open' : ''}`}>
  <div className="controls-content">
    
    {/* CATEGORY: MELODY DIFFICULTY */}
    <div className="control-section">
      <h3 className="section-title">Melody Difficulty</h3>
      <div className="toggle-grid-sleek">
        <div 
          className={`toggle-pill-btn ${props.difficulty === 'easy' ? 'active' : ''}`} 
          onClick={() => props.setDifficulty('easy')}
        >
          Easy
        </div>
        <div 
          className={`toggle-pill-btn ${props.difficulty === 'normal' ? 'active' : ''}`} 
          onClick={() => props.setDifficulty('normal')}
        >
          Normal
        </div>
        <div 
          className={`toggle-pill-btn ${props.difficulty === 'hard' ? 'active' : ''}`} 
          onClick={() => props.setDifficulty('hard')}
        >
          Hard
        </div>
      </div>
    </div>

    {/* CATEGORY: MELODY FLOW */}
    <div className="control-section">
      <h3 className="section-title">Melody Flow</h3>
      <div className="toggle-grid-sleek">
        <div 
          className={`toggle-pill-btn ${props.hideFretboardVisuals ? 'active' : ''}`} 
          onClick={() => props.setHideFretboardVisuals(!props.hideFretboardVisuals)}
          title="Blind Mode"
        >
        Blind Mode
        </div>
         <div 
           className={`toggle-pill-btn ${props.startRoot ? 'active' : ''}`} 
           onClick={() => props.setStartRoot(!props.startRoot)}
         >
           Start on 1
         </div>
         <div 
           className={`toggle-pill-btn ${props.endRoot ? 'active' : ''}`} 
           onClick={() => props.setEndRoot(!props.endRoot)}
         >
           End on 1
         </div>

         {/* HIDE Pitch Guide and Inverse buttons in Fretboard mode */}
         {props.activeTab !== 'fretboard' && (
           <>
             <div 
               className={`icon-toggle-btn ${props.trainingWheels ? 'active' : ''}`} 
               onClick={() => props.setTrainingWheels(!props.trainingWheels)} 
               title="Pitch Guide"
             >
                <TrainingWheelsIcon />
             </div>

             <div 
               className={`icon-toggle-btn ${props.inverseMode ? 'active' : ''}`} 
               onClick={() => props.setInverseMode(!props.inverseMode)} 
               title="Inverse Mode"
               style={{ marginLeft: '8px' }}
             >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
             </div>
           </>
         )}
      </div>
    </div>

{/* CATEGORY: REPETITION */}
<div className="control-section">
  <h3 className="section-title">Repetition</h3>
  <div className="row-split">
      <div className="stepper-label">Melodies Per Key</div>
      <div className="stepper-control">
          <button className="stepper-btn" onClick={() => adjustQuestions(-1)}><MinusIcon/></button>
          <input 
            type="number" 
            className="stepper-input" 
            value={props.questionsPerKey}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) props.setQuestionsPerKey(Math.max(1, Math.min(50, val)));
            }}
          />
          <button className="stepper-btn" onClick={() => adjustQuestions(1)}><PlusIcon/></button>
      </div>
  </div>
</div>

          {/* RHYTHM */}
          <div className="control-section">
             <h3 className="section-title">Rhythm</h3>
             <div className="tempo-row" style={{marginBottom: '8px'}}>
                {TEMPOS.map(t => (
                    <button key={t} className={`tempo-btn ${props.bpm === t ? 'active' : ''}`} onClick={() => props.setBpm(t)}>{t}</button>
                ))}
             </div>
             <div className="row-split">
                <span className="stepper-label">Groove</span>
                <select 
                  className="pattern-select" 
                  value={props.currentPattern}
                  onChange={(e) => props.setPattern(e.target.value)}
                >
                    {Object.keys(DRUM_PATTERNS).map(name => (<option key={name} value={name}>{name}</option>))}
                </select>
             </div>
          </div>

          {/* MIXER */}
          <div className="control-section no-border">
            <h3 className="section-title">Mixer</h3>
            
            {/* Show Guide volume if Pitch Guide OR Inverse Mode is active */}
            {(props.trainingWheels || props.inverseMode) && (
                <div className="slider-row">
                    <span style={{color:'var(--c-3)'}}>Guide</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={props.volTraining} 
                      onChange={e => props.setVolTraining(parseFloat(e.target.value))} 
                    />
                </div>
            )}

            <div className="slider-row">
                <span>Master</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volMaster} onChange={e => props.setVolMaster(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span onClick={() => props.toggleMute('voice', props.volVoice, props.setVolVoice)} className={props.volVoice === 0 ? 'muted-label' : 'active-label'}>Voice</span>
                <input type="range" min="0" max="1.5" step="0.1" value={props.volVoice} onChange={e => props.setVolVoice(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span>Reverb</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volReverb} onChange={e => props.setVolReverb(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span onClick={() => props.toggleMute('drone', props.volDrone, props.setVolDrone)} className={props.volDrone === 0 ? 'muted-label' : 'active-label'}>Drone</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volDrone} onChange={e => props.setVolDrone(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span onClick={() => props.toggleMute('groove', props.volGroove, props.setVolGroove)} className={props.volGroove === 0 ? 'muted-label' : 'active-label'}>Drums</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volGroove} onChange={e => props.setVolGroove(parseFloat(e.target.value))} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}