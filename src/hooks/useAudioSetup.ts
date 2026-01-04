import { useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import type { NoteEvent } from '../types';

interface AudioSetupProps {
  bpm: number;
  volMaster: number;
  volDrone: number;
  volGroove: number;
  volVoice: number;
  volClick: number;
  volReverb: number;
  debugClick: boolean;
  volMetronome: number;
  setTriggerPulse: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveMidi: React.Dispatch<React.SetStateAction<number | null>>;
  visualTimeoutRef: React.MutableRefObject<number>;
}

export function useAudioSetup(props: AudioSetupProps) {
  const { 
    bpm, volMaster, volDrone, volGroove, volVoice, volClick, 
    volReverb, debugClick, volMetronome, 
    setTriggerPulse, setActiveMidi, visualTimeoutRef 
  } = props;

  // 1. Sync Audio Engine Parameters
  useEffect(() => {
    audioEngine.setMasterVol(volMaster);
    audioEngine.setDroneVol(volDrone);
    audioEngine.setDrumVol(volGroove);
    audioEngine.setVocalVol(volVoice);
    audioEngine.setClickVol(volClick);
    audioEngine.setReverbMix(volReverb);
    audioEngine.setBpm(bpm);
    audioEngine.setDebugClick(debugClick);
    audioEngine.setMetronomeVol(volMetronome);
  }, [bpm, volMaster, volDrone, volGroove, volVoice, volClick, volReverb, debugClick, volMetronome]);

  // 2. Bind Callbacks
  useEffect(() => {
    audioEngine.onNotePlay = (note: NoteEvent | null, isClick?: boolean) => {
      if (isClick) return; 
      
      if (note) {
        // Visualizer logic
        setActiveMidi(note.noteInfo.midi);
        if (visualTimeoutRef.current) clearTimeout(visualTimeoutRef.current);
        
        const secPerBeat = 60 / bpm; 
        // Hold visual slightly less than duration so gaps are visible
        const holdTime = (note.duration * secPerBeat * 1000) - 50; 
        
        visualTimeoutRef.current = setTimeout(() => setActiveMidi(null), holdTime);
      }
    };

    audioEngine.onBeat = (_) => { 
        setTriggerPulse(p => !p); 
    };
  }, [bpm, setActiveMidi, setTriggerPulse, visualTimeoutRef]);
}