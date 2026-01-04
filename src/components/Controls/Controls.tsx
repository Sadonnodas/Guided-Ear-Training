import { useState, useEffect } from 'react';
import './Controls.css';

const PlayIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const StopIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>; 
const ChevronIcon = ({open}: {open: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}><path d="M6 9l6 6 6-6"/></svg>;
const MetronomeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 20h16L12 2z" /><path d="M12 6v8" /></svg>;

const TEMPOS = [60, 80, 100, 120, 150];

interface ControlsProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  bpm: number;
  setBpm: (b: number) => void;
  triggerPulse: boolean; 
  
  startRoot: boolean; setStartRoot: (v: boolean) => void;
  endRoot: boolean; setEndRoot: (v: boolean) => void;
  silentPractice: boolean; setSilentPractice: (v: boolean) => void;
  questionsPerKey: number; setQuestionsPerKey: (n: number) => void;

  volMaster: number; setVolMaster: (v: number) => void;
  volVoice: number; setVolVoice: (v: number) => void;
  volDrone: number; setVolDrone: (v: number) => void;
  volGroove: number; setVolGroove: (v: number) => void;
  volReverb: number; setVolReverb: (v: number) => void;
  toggleMute: (type: string, val: number, setter: (v: number) => void) => void;
  
  // NEW
  debugClick: boolean; setDebugClick: (v: boolean) => void;
}

export default function Controls(props: ControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (props.isPlaying) {
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 100); 
        return () => clearTimeout(timer);
    }
  }, [props.triggerPulse, props.isPlaying]);

  return (
    <>
      <div className="play-btn-container">
          <button 
            className={`play-btn ${props.isPlaying ? 'playing' : ''} ${animate ? 'pulse-beat' : ''}`} 
            onClick={props.onPlayToggle}
          >
            {props.isPlaying ? <StopIcon /> : <PlayIcon />}
          </button>
      </div>

      <div className="settings-trigger" onClick={() => setSettingsOpen(!settingsOpen)}>
        <span>Controls</span>
        <ChevronIcon open={settingsOpen} />
      </div>

      <div className={`controls-accordion ${settingsOpen ? 'open' : ''}`}>
        <div className="controls-content">
          <div className="toggle-grid">
             <div className={`toggle-card ${props.startRoot ? 'active' : ''}`} onClick={() => props.setStartRoot(!props.startRoot)} title="Melodies always start on the Root (1)">Start on 1</div>
             <div className={`toggle-card ${props.endRoot ? 'active' : ''}`} onClick={() => props.setEndRoot(!props.endRoot)} title="Melodies always resolve to the Root (1)">End on 1</div>
             <div className={`toggle-card ${props.silentPractice ? 'active' : ''}`} onClick={() => props.setSilentPractice(!props.silentPractice)} title="Sequence: Listen, Sing Along, then Silence">Silent Mode</div>
          </div>

          <div className="tempo-row">
            {TEMPOS.map(t => (
                <button key={t} className={`tempo-btn ${props.bpm === t ? 'active' : ''}`} onClick={() => props.setBpm(t)}>{t}</button>
            ))}
          </div>

           <div className="slider-row">
            <span>Cycle Length</span>
            <div style={{flex: 1, display: 'flex', gap: '10px', alignItems: 'center'}}>
                <input type="range" min="1" max="50" step="1" value={props.questionsPerKey} onChange={e => props.setQuestionsPerKey(parseInt(e.target.value))} />
                <span style={{minWidth: '20px', fontSize: '0.8rem', textAlign: 'right'}}>{props.questionsPerKey}</span>
            </div>
          </div>
          
          <div className="slider-row">
            <span style={{fontWeight:'bold'}}>Master</span>
            <input type="range" min="0" max="1" step="0.05" value={props.volMaster} onChange={e => props.setVolMaster(parseFloat(e.target.value))} />
          </div>

          <div className="slider-row">
            <span onClick={() => props.toggleMute('voice', props.volVoice, props.setVolVoice)} className={props.volVoice===0 ? 'muted-label' : 'active-label'}>Voice</span>
            <input type="range" min="0" max="1.5" step="0.1" value={props.volVoice} onChange={e => props.setVolVoice(parseFloat(e.target.value))} />
          </div>
          <div className="slider-row">
            <span>Reverb</span>
            <input type="range" min="0" max="1" step="0.05" value={props.volReverb} onChange={e => props.setVolReverb(parseFloat(e.target.value))} />
          </div>
          <div className="slider-row">
            <span onClick={() => props.toggleMute('groove', props.volGroove, props.setVolGroove)} className={props.volGroove===0 ? 'muted-label' : 'active-label'}>Groove</span>
            <input type="range" min="0" max="1" step="0.05" value={props.volGroove} onChange={e => props.setVolGroove(parseFloat(e.target.value))} />
          </div>
          <div className="slider-row">
            <span onClick={() => props.toggleMute('drone', props.volDrone, props.setVolDrone)} className={props.volDrone===0 ? 'muted-label' : 'active-label'}>Drone</span>
            <input type="range" min="0" max="1" step="0.05" value={props.volDrone} onChange={e => props.setVolDrone(parseFloat(e.target.value))} />
          </div>

           {/* DEBUG METRONOME TOGGLE */}
           <div className="slider-row" style={{borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop:'5px'}}>
             <div 
               className={`toggle-card ${props.debugClick ? 'active' : ''}`} 
               onClick={() => props.setDebugClick(!props.debugClick)}
               style={{width: '100%', flexDirection: 'row', gap: '10px'}}
             >
               <MetronomeIcon />
               <span>Debug Metronome (Check Sync)</span>
             </div>
           </div>

        </div>
      </div>
    </>
  );
}