import { useState, useEffect } from 'react';
import { DRUM_PATTERNS } from '../../config/AudioConfig';
import type { MelodyDifficulty } from '../../types'; 
import VoiceRangeControl from '../VoiceRangeControl/VoiceRangeControl';
import { calibrateVocalRange } from '../VoiceRangeControl/PitchDetector';
import './Controls.css';

// --- ICONS ---
const PlayIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>;
const StopIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>; 
const ChevronIcon = ({open}: {open: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}><path d="M6 9l6 6 6-6"/></svg>;
const MinusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>;
const TrainingWheelsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="M12 2v6" /><path d="M12 16v6" /><path d="M2 12h6" /><path d="M16 12h6" /></svg>;
const EyeOffIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const InverseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const MetronomeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 20h16L12 2z" /><path d="M12 6v8" /></svg>;
const TutorialIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;

// Tab icons
const MelodyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
const RhythmIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const MixerIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
const MoreIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>;

const TEMPOS = [60, 80, 100, 120, 150];

type ControlTab = 'melody' | 'rhythm' | 'mixer' | 'more';

interface ControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlayToggle: () => void;
  onStop: () => void; 
  bpm: number; setBpm: (b: number) => void;
  triggerPulse: boolean; 
  startRoot: boolean; setStartRoot: (v: boolean) => void;
  endRoot: boolean; setEndRoot: (v: boolean) => void;
  silentPractice: boolean; setSilentPractice: (v: boolean) => void;
  trainingWheels: boolean; setTrainingWheels: (v: boolean) => void;
  inverseMode: boolean; setInverseMode: (v: boolean) => void;
  questionsPerKey: number; setQuestionsPerKey: (n: number) => void;
  difficulty: MelodyDifficulty; 
  setDifficulty: (d: MelodyDifficulty) => void;
  debugClick: boolean;
  setDebugClick: (v: boolean) => void;
  
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
  
  minVocalMidi: number;
  maxVocalMidi: number;
  setMinVocalMidi: (n: number) => void;
  setMaxVocalMidi: (n: number) => void;
}

export default function Controls(props: ControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeControlTab, setActiveControlTab] = useState<ControlTab>('melody');
  const [animate, setAnimate] = useState(false);
  const [showTutorialButton, setShowTutorialButton] = useState(false);

  const isTrainingMode = props.activeTab === 'training';

  const beatDuration = ((60 / props.bpm) * 0.9).toFixed(3);

  useEffect(() => {
    const completed = localStorage.getItem('tutorial-completed');
    setShowTutorialButton(!!completed);
  }, []);

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

  const handleAutoCalibrate = async () => {
    try {
      const result = await calibrateVocalRange();
      props.setMinVocalMidi(result.min);
      props.setMaxVocalMidi(result.max);
      return result;
    } catch (e) {
      console.error('Calibration failed:', e);
      throw e;
    }
  };

  const restartTutorial = () => {
    localStorage.removeItem('tutorial-completed');
    window.location.reload();
  };

  const isFretboardTab = props.activeTab === 'fretboard';
  const isRandomTab = props.activeTab === 'random';
  const showBlindMode = isFretboardTab || props.inverseMode;
  const showPitchGuideAndInverse = isRandomTab;
  const showGuideVolume = props.trainingWheels || props.inverseMode || isFretboardTab;

  return (
    <>
      <div className="play-btn-container">
        <button 
          className={`play-btn ${props.isPlaying ? 'playing' : ''} ${animate ? 'pulse-beat' : ''}`} 
          onClick={props.onPlayToggle}
          style={{ "--beat-dur": `${beatDuration}s` } as React.CSSProperties}
          title={props.isPlaying ? "Pause session" : "Start practice session"}
        >
          {props.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div 
          className={`stop-mini-btn ${props.isPlaying || props.isPaused ? 'visible' : ''}`} 
          onClick={props.onStop}
          title="Stop and restart session"
        >
          <StopIcon />
          <span className="mini-label">RESTART</span>
        </div>
      </div>

      <div className="settings-trigger" onClick={() => setSettingsOpen(!settingsOpen)}>
        <span>Controls</span>
        <ChevronIcon open={settingsOpen} />
      </div>

      <div className={`controls-accordion ${settingsOpen ? 'open' : ''}`}>
        {/* Control Tabs */}
        <div className="control-tabs">
          <button
            className={`control-tab ${activeControlTab === 'melody' ? 'active' : ''}`}
            onClick={() => setActiveControlTab('melody')}
            title="Melody settings: difficulty, flow, repetitions, and vocal range"
          >
            <MelodyIcon />
            <span>Melody</span>
          </button>
          <button
            className={`control-tab ${activeControlTab === 'rhythm' ? 'active' : ''}`}
            onClick={() => setActiveControlTab('rhythm')}
            title="Rhythm settings: tempo, groove, and metronome"
          >
            <RhythmIcon />
            <span>Rhythm</span>
          </button>
          <button
            className={`control-tab ${activeControlTab === 'mixer' ? 'active' : ''}`}
            onClick={() => setActiveControlTab('mixer')}
            title="Audio mixer: volume levels for all instruments"
          >
            <MixerIcon />
            <span>Mixer</span>
          </button>
          <button
            className={`control-tab ${activeControlTab === 'more' ? 'active' : ''}`}
            onClick={() => setActiveControlTab('more')}
            title="Additional options and tutorial"
          >
            <MoreIcon />
            <span>More</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="controls-content">
          
          {/* MELODY TAB */}
          {activeControlTab === 'melody' && (
            <>
              <div className="control-section">
                <h3 className="section-title">Difficulty</h3>
                <div className="toggle-grid-sleek">
                  <div 
                    className={`toggle-pill-btn ${props.difficulty === 'easiest' ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setDifficulty('easiest')}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls difficulty progression" 
                      : "Easiest: Stepwise motion with occasional small leaps"}
                  >
                    Easiest
                  </div>
                  <div 
                    className={`toggle-pill-btn ${props.difficulty === 'easy' ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setDifficulty('easy')}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls difficulty progression" 
                      : "Easy: Smaller intervals, mostly stepwise motion"}
                  >
                    Easy
                  </div>
                  <div 
                    className={`toggle-pill-btn ${props.difficulty === 'normal' ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setDifficulty('normal')}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls difficulty progression" 
                      : "Normal: Balanced difficulty with varied intervals"}
                  >
                    Normal
                  </div>
                  <div 
                    className={`toggle-pill-btn ${props.difficulty === 'hard' ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setDifficulty('hard')}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls difficulty progression" 
                      : "Hard: Challenging melodies with larger leaps"}
                  >
                    Hard
                  </div>
                </div>
                
                {/* NEW: Show explanation in training mode */}
                {isTrainingMode && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-muted)', 
                    marginTop: '8px',
                    textAlign: 'center',
                    opacity: 0.8
                  }}>
                    Training mode automatically adjusts difficulty
                  </div>
                )}
              </div>
              <div className="control-section">
                <h3 className="section-title">Melody Flow</h3>
                <div className="toggle-grid-sleek">
                  <div 
                    className={`toggle-pill-btn ${props.startRoot ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setStartRoot(!props.startRoot)}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls start/end constraints" 
                      : "Melodies always start on the root note (1)"}
                  >
                    Start on 1
                  </div>
                  
                  <div 
                    className={`toggle-pill-btn ${props.endRoot ? 'active' : ''}`} 
                    onClick={() => !isTrainingMode && props.setEndRoot(!props.endRoot)}
                    style={{ 
                      opacity: isTrainingMode ? 0.5 : 1,
                      cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                    }}
                    title={isTrainingMode 
                      ? "Training mode controls start/end constraints" 
                      : "Melodies always end on the root note (1)"}
                  >
                    End on 1
                  </div>

                  {showPitchGuideAndInverse && (
                    <div 
                      className={`icon-toggle-btn ${props.trainingWheels ? 'active' : ''}`} 
                      onClick={() => !isTrainingMode && props.setTrainingWheels(!props.trainingWheels)}
                      style={{ 
                        opacity: isTrainingMode ? 0.5 : 1,
                        cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                      }}
                      title={isTrainingMode 
                        ? "Training mode controls pitch guide (enabled in Stages 1-2)" 
                        : "Pitch Guide: Synth plays along with your singing for reference"}
                    >
                      <TrainingWheelsIcon />
                    </div>
                  )}

                  {showPitchGuideAndInverse && (
                    <div 
                      className={`icon-toggle-btn ${props.inverseMode ? 'active' : ''}`} 
                      onClick={() => props.setInverseMode(!props.inverseMode)} 
                      title="Inverse Mode: Listen first, then sing the melody back"
                    >
                      <InverseIcon />
                    </div>
                  )}

                  {showBlindMode && (
                    <div 
                      className={`icon-toggle-btn ${props.hideFretboardVisuals ? 'active' : ''}`} 
                      onClick={() => props.setHideFretboardVisuals(!props.hideFretboardVisuals)}
                      title="Blind Mode: Hide visual indicators during practice"
                    >
                      <EyeOffIcon />
                    </div>
                  )}
                </div>
              </div>
                
              

              <div className="control-section">
                <h3 className="section-title">Repetition</h3>
                <div className="row-split">
                  <div className="stepper-label">Melodies Per Key</div>
                  <div className="stepper-control">
                    <button 
                      className="stepper-btn" 
                      onClick={() => !isTrainingMode && adjustQuestions(-1)}
                      style={{ 
                        opacity: isTrainingMode ? 0.5 : 1,
                        cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                      }}
                      title={isTrainingMode 
                        ? "Training mode controls key changes" 
                        : "Decrease repetitions"}
                    >
                      <MinusIcon/>
                    </button>
                    <input 
                      type="number" 
                      className="stepper-input" 
                      value={props.questionsPerKey}
                      onChange={(e) => {
                        if (isTrainingMode) return;
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) props.setQuestionsPerKey(Math.max(1, Math.min(50, val)));
                      }}
                      style={{ 
                        opacity: isTrainingMode ? 0.5 : 1,
                        cursor: isTrainingMode ? 'not-allowed' : 'text'
                      }}
                      title={isTrainingMode 
                        ? "Training mode controls key changes" 
                        : "Number of melodies to practice per key"}
                      disabled={isTrainingMode}
                    />
                    <button 
                      className="stepper-btn" 
                      onClick={() => !isTrainingMode && adjustQuestions(1)}
                      style={{ 
                        opacity: isTrainingMode ? 0.5 : 1,
                        cursor: isTrainingMode ? 'not-allowed' : 'pointer'
                      }}
                      title={isTrainingMode 
                        ? "Training mode controls key changes" 
                        : "Increase repetitions"}
                    >
                      <PlusIcon/>
                    </button>
                  </div>
                </div>
                
                {/* NEW: Show explanation in training mode */}
                {isTrainingMode && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-muted)', 
                    marginTop: '8px',
                    textAlign: 'center',
                    opacity: 0.8
                  }}>
                    Stage 4 modulates every 10 melodies
                  </div>
                )}
              </div>

              <div className="control-section no-border">
                <VoiceRangeControl
                  minMidi={props.minVocalMidi}
                  maxMidi={props.maxVocalMidi}
                  onRangeChange={(min, max) => {
                    props.setMinVocalMidi(min);
                    props.setMaxVocalMidi(max);
                  }}
                  onAutoCalibrate={handleAutoCalibrate}
                />
              </div>
            </>
          )}

          {/* RHYTHM TAB */}
          {activeControlTab === 'rhythm' && (
            <>
              <div className="control-section">
                <h3 className="section-title">Tempo</h3>
                <div className="tempo-row">
                  {TEMPOS.map(t => (
                    <button 
                      key={t} 
                      className={`tempo-btn ${props.bpm === t ? 'active' : ''}`} 
                      onClick={() => props.setBpm(t)}
                      title={`Set tempo to ${t} BPM`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-section no-border">
                <h3 className="section-title">Groove & Click</h3>
                <div className="row-split" style={{marginBottom: '12px'}}>
                  <span className="stepper-label">Drum Pattern</span>
                  <select 
                    className="pattern-select" 
                    value={props.currentPattern}
                    onChange={(e) => props.setPattern(e.target.value)}
                    title="Select drum pattern style"
                  >
                    {Object.keys(DRUM_PATTERNS).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="row-split">
                  <span className="stepper-label">Metronome Click</span>
                  <div 
                    className={`icon-toggle-btn ${props.debugClick ? 'active' : ''}`} 
                    onClick={() => props.setDebugClick(!props.debugClick)} 
                    title="Toggle metronome click on beats"
                    style={{ background: props.debugClick ? 'var(--btn-play)' : undefined }}
                  >
                    <MetronomeIcon />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* MIXER TAB */}
          {activeControlTab === 'mixer' && (
            <>
              <div className="control-section no-border">
                <h3 className="section-title">Volume Levels</h3>
                
                {showGuideVolume && (
                  <div className="slider-row">
                    <span style={{color:'var(--c-3)'}} title="Volume of pitch guide synth">Guide</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={props.volTraining} 
                      onChange={e => props.setVolTraining(parseFloat(e.target.value))}
                      title="Adjust pitch guide volume"
                    />
                  </div>
                )}

                <div className="slider-row">
                  <span title="Master volume control">Master</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={props.volMaster} 
                    onChange={e => props.setVolMaster(parseFloat(e.target.value))}
                    title="Adjust master volume"
                  />
                </div>
                <div className="slider-row">
                  <span 
                    onClick={() => props.toggleMute('voice', props.volVoice, props.setVolVoice)} 
                    className={props.volVoice === 0 ? 'muted-label' : 'active-label'}
                    title="Click to mute/unmute voice samples"
                  >
                    Voice
                  </span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1.5" 
                    step="0.1" 
                    value={props.volVoice} 
                    onChange={e => props.setVolVoice(parseFloat(e.target.value))}
                    title="Adjust vocal sample volume"
                  />
                </div>
                <div className="slider-row">
                  <span title="Reverb amount">Reverb</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={props.volReverb} 
                    onChange={e => props.setVolReverb(parseFloat(e.target.value))}
                    title="Adjust reverb effect intensity"
                  />
                </div>
                <div className="slider-row">
                  <span 
                    onClick={() => props.toggleMute('drone', props.volDrone, props.setVolDrone)} 
                    className={props.volDrone === 0 ? 'muted-label' : 'active-label'}
                    title="Click to mute/unmute drone"
                  >
                    Drone
                  </span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={props.volDrone} 
                    onChange={e => props.setVolDrone(parseFloat(e.target.value))}
                    title="Adjust root note drone volume"
                  />
                </div>
                <div className="slider-row">
                  <span 
                    onClick={() => props.toggleMute('groove', props.volGroove, props.setVolGroove)} 
                    className={props.volGroove === 0 ? 'muted-label' : 'active-label'}
                    title="Click to mute/unmute drums"
                  >
                    Drums
                  </span>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={props.volGroove} 
                    onChange={e => props.setVolGroove(parseFloat(e.target.value))}
                    title="Adjust drum pattern volume"
                  />
                </div>
              </div>
            </>
          )}

          {/* MORE TAB */}
          {activeControlTab === 'more' && (
            <div className="control-section no-border">
              <h3 className="section-title">Help & Tutorial</h3>
              <p className="help-text">
                💡 <strong>Tip:</strong> Hover over any button or control to see helpful information about what it does!
              </p>
              {showTutorialButton && (
                <button 
                  className="tutorial-restart-btn-full"
                  onClick={restartTutorial}
                  title="Restart the interactive tutorial walkthrough"
                >
                  <TutorialIcon />
                  <span>Restart Interactive Tutorial</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}