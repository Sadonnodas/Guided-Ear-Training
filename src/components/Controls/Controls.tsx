import { useState, useEffect } from 'react';
import './Controls.css';

const PlayIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const StopIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>; 
const ChevronIcon = ({open}: {open: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}><path d="M6 9l6 6 6-6"/></svg>;
const MinusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>;

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
  volMetronome: number; setVolMetronome: (v: number) => void; // NEW
  toggleMute: (type: string, val: number, setter: (v: number) => void) => void;
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
          
          {/* --- SECTION: SESSION --- */}
          <div className="control-section">
            <h3 className="section-title">Session</h3>
            
            <div className="toggle-grid">
               <div className={`toggle-card ${props.startRoot ? 'active' : ''}`} onClick={() => props.setStartRoot(!props.startRoot)} title="Melodies always start on the Root (1)">Start on 1</div>
               <div className={`toggle-card ${props.endRoot ? 'active' : ''}`} onClick={() => props.setEndRoot(!props.endRoot)} title="Melodies always resolve to the Root (1)">End on 1</div>
               <div className={`toggle-card ${props.silentPractice ? 'active' : ''}`} onClick={() => props.setSilentPractice(!props.silentPractice)} title="Sequence: Listen, Sing Along, then Silence">Silent Mode</div>
            </div>

            <div className="row-split">
                <div className="stepper-label" title="How many melodies to play before changing key">Cycle Length</div>
                <div className="stepper-control">
                    <button className="stepper-btn" onClick={() => adjustQuestions(-1)}><MinusIcon/></button>
                    <div className="stepper-value">{props.questionsPerKey}</div>
                    <button className="stepper-btn" onClick={() => adjustQuestions(1)}><PlusIcon/></button>
                </div>
            </div>
          </div>

          {/* --- SECTION: TEMPO --- */}
          <div className="control-section">
             <h3 className="section-title">Tempo</h3>
             <div className="tempo-row">
                {TEMPOS.map(t => (
                    <button key={t} className={`tempo-btn ${props.bpm === t ? 'active' : ''}`} onClick={() => props.setBpm(t)}>{t}</button>
                ))}
             </div>
          </div>

          {/* --- SECTION: MIXER --- */}
          <div className="control-section no-border">
            <h3 className="section-title">Mixer</h3>
            
            <div className="slider-row">
                <span title="Overall Volume">Master</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volMaster} onChange={e => props.setVolMaster(parseFloat(e.target.value))} />
            </div>

            <div className="slider-row">
                <span title="Volume of the singing voice" onClick={() => props.toggleMute('voice', props.volVoice, props.setVolVoice)} className={props.volVoice===0 ? 'muted-label' : 'active-label'}>Voice</span>
                <input type="range" min="0" max="1.5" step="0.1" value={props.volVoice} onChange={e => props.setVolVoice(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span title="Amount of echo/space on the voice">Reverb</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volReverb} onChange={e => props.setVolReverb(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span title="Volume of the drum beat" onClick={() => props.toggleMute('groove', props.volGroove, props.setVolGroove)} className={props.volGroove===0 ? 'muted-label' : 'active-label'}>Groove</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volGroove} onChange={e => props.setVolGroove(parseFloat(e.target.value))} />
            </div>
            <div className="slider-row">
                <span title="Volume of the background chord" onClick={() => props.toggleMute('drone', props.volDrone, props.setVolDrone)} className={props.volDrone===0 ? 'muted-label' : 'active-label'}>Drone</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volDrone} onChange={e => props.setVolDrone(parseFloat(e.target.value))} />
            </div>
            
             {/* NEW METRONOME SLIDER */}
             <div className="slider-row">
                <span title="Volume of the metronome click">Metronome</span>
                <input type="range" min="0" max="1" step="0.05" value={props.volMetronome} onChange={e => props.setVolMetronome(parseFloat(e.target.value))} />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}