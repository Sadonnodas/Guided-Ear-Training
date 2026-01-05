import { useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface AudioSetupProps {
  bpm: number;
  volMaster: number;
  volGroove: number;
  volVoice: number;
  volMetronome: number;
  volDrone: number; // RESTORED
  debugClick: boolean;
  setTriggerPulse: (v: boolean) => void;
  setActiveMidi: (m: number | null) => void;
  visualTimeoutRef: React.MutableRefObject<number>;
}

export function useAudioSetup(props: AudioSetupProps) {
  useEffect(() => {
    audioEngine.onBeat = () => {
      props.setTriggerPulse(true);
      setTimeout(() => props.setTriggerPulse(false), 150);
    };

    audioEngine.onNotePlay = (note) => {
      if (note) {
        props.setActiveMidi(note.noteInfo.midi);
        window.clearTimeout(props.visualTimeoutRef.current);
        props.visualTimeoutRef.current = window.setTimeout(() => {
          props.setActiveMidi(null);
        }, 600);
      }
    };
  }, []);

  useEffect(() => { audioEngine.setBpm(props.bpm); }, [props.bpm]);
  useEffect(() => { audioEngine.setMasterVol(props.volMaster); }, [props.volMaster]);
  useEffect(() => { audioEngine.setVocalVol(props.volVoice); }, [props.volVoice]);
  useEffect(() => { audioEngine.setDrumVol(props.volGroove); }, [props.volGroove]);
  useEffect(() => { audioEngine.setClickVol(props.volMetronome); }, [props.volMetronome]);
  useEffect(() => { audioEngine.setDroneVol(props.volDrone); }, [props.volDrone]); // RESTORED
  useEffect(() => { audioEngine.setDebugClick(props.debugClick); }, [props.debugClick]);
}