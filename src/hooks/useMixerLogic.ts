import { useState, useEffect } from "react";
import { audioEngine } from "../audio/AudioEngine";

export function useMixerLogic() {
  const [volMaster, setVolMaster] = useState(1.0);
  const [volVoice, setVolVoice] = useState(1.0);
  const [volDrone, setVolDrone] = useState(0.4);
  const [volGroove, setVolGroove] = useState(0.6);
  const [volMetronome, setVolMetronome] = useState(0.8);
  const [volTraining, setVolTraining] = useState(0.4);
  const [volReverb, setVolReverb] = useState(0.3);
  const [volBass, setVolBass] = useState(0.7);    // NEW
  const [volPiano, setVolPiano] = useState(0.6);  // NEW

  // Sync to AudioEngine
  useEffect(() => { audioEngine.setMasterVol(volMaster); }, [volMaster]);
  useEffect(() => { audioEngine.setVocalVol(volVoice); }, [volVoice]);
  useEffect(() => { audioEngine.setDroneVol(volDrone); }, [volDrone]);
  useEffect(() => { audioEngine.setDrumVol(volGroove); }, [volGroove]);
  useEffect(() => { audioEngine.setClickVol(volMetronome); }, [volMetronome]);
  useEffect(() => { audioEngine.setTrainingVol(volTraining); }, [volTraining]);
  useEffect(() => { audioEngine.setReverbAmt(volReverb); }, [volReverb]);
  useEffect(() => { audioEngine.setBassVolume(volBass); }, [volBass]);      // NEW
  useEffect(() => { audioEngine.setPianoVolume(volPiano); }, [volPiano]);    // NEW

  return {
    volMaster, setVolMaster,
    volVoice, setVolVoice,
    volDrone, setVolDrone,
    volGroove, setVolGroove,
    volMetronome, setVolMetronome,
    volTraining, setVolTraining,
    volReverb, setVolReverb,
    volBass, setVolBass,        // NEW
    volPiano, setVolPiano,      // NEW
  };
}