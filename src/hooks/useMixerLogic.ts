import { useEffect } from "react";
import { audioEngine } from "../audio/AudioEngine";
import { usePersistentState, asNumber } from "./usePersistentState";

// The widest slider in the mixer runs to 1.5; anything outside that was not
// written by this app.
const asVolume = asNumber(0, 1.5);

export function useMixerLogic() {
  const [volMaster, setVolMaster] = usePersistentState("volMaster", 1.0, asVolume);
  const [volVoice, setVolVoice] = usePersistentState("volVoice", 1.0, asVolume);
  const [volDrone, setVolDrone] = usePersistentState("volDrone", 0.4, asVolume);
  const [volGroove, setVolGroove] = usePersistentState("volGroove", 0.6, asVolume);
  const [volMetronome, setVolMetronome] = usePersistentState("volMetronome", 0.8, asVolume);
  const [volTraining, setVolTraining] = usePersistentState("volTraining", 0.4, asVolume);
  const [volReverb, setVolReverb] = usePersistentState("volReverb", 0.3, asVolume);
  const [volBass, setVolBass] = usePersistentState("volBass", 0.7, asVolume);
  const [volPiano, setVolPiano] = usePersistentState("volPiano", 0.6, asVolume);

  // Sync to AudioEngine
  useEffect(() => { audioEngine.setMasterVol(volMaster); }, [volMaster]);
  useEffect(() => { audioEngine.setVocalVol(volVoice); }, [volVoice]);
  useEffect(() => { audioEngine.setDroneVol(volDrone); }, [volDrone]);
  useEffect(() => { audioEngine.setDrumVol(volGroove); }, [volGroove]);
  useEffect(() => { audioEngine.setClickVol(volMetronome); }, [volMetronome]);
  useEffect(() => { audioEngine.setTrainingVol(volTraining); }, [volTraining]);
  useEffect(() => { audioEngine.setReverbAmt(volReverb); }, [volReverb]);
  useEffect(() => { audioEngine.setBassVolume(volBass); }, [volBass]);
  useEffect(() => { audioEngine.setPianoVolume(volPiano); }, [volPiano]);

  return {
    volMaster, setVolMaster,
    volVoice, setVolVoice,
    volDrone, setVolDrone,
    volGroove, setVolGroove,
    volMetronome, setVolMetronome,
    volTraining, setVolTraining,
    volReverb, setVolReverb,
    volBass, setVolBass,
    volPiano, setVolPiano,
  };
}
