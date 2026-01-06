import { useState, useRef, useEffect } from 'react';
import { MAJOR_LEVELS, MINOR_LEVELS, CHROMATIC_LEVELS } from '../config/TrainingLevels';
import type { MelodyConstraints, ScaleDegree, ScaleType, TrainingLevel } from '../types';

// ACCEPT scaleType as an argument
export function useTrainingMode(scaleType: ScaleType) {
  
  // 1. Determine which levels array to use
  let currentLevels: TrainingLevel[] = MAJOR_LEVELS;
  if (scaleType === 'Minor') currentLevels = MINOR_LEVELS;
  else if (scaleType === 'Chromatic') currentLevels = CHROMATIC_LEVELS; // or fallback to MAJOR if empty

  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const activeLevelIdRef = useRef(1); 
  
  const [uiSessionTime, setUiSessionTime] = useState(0); 
  const [stageLabel, setStageLabel] = useState("");
  
  const timeRef = useRef(0);
  const timerInterval = useRef<number>(0);
  const [userDurationMinutes, setUserDurationMinutes] = useState(5); 

  useEffect(() => {
    activeLevelIdRef.current = activeLevelId;
  }, [activeLevelId]);

  // SAFETY: If we switch scales, ensure ID 1 is valid, or reset if needed
  useEffect(() => {
      // If the current ID doesn't exist in the new scale (e.g. switching Major Lvl 10 -> Minor), reset to 1
      const exists = currentLevels.find(l => l.id === activeLevelId);
      if (!exists) setActiveLevelId(1);
  }, [scaleType]);

  const getCurrentConfig = () => {
    const currentId = activeLevelIdRef.current;
    
    // 2. Look up level in the DYNAMIC list, not the hardcoded MAJOR list
    const level = currentLevels.find(l => l.id === currentId);
    
    // Default fallback
    if (!level) return { 
        constraints: { allowedDegrees: ["1"], length: 4 } as MelodyConstraints,
        questionsPerKey: Infinity,
        stageIndex: -1,
        introSequence: undefined as ScaleDegree[] | undefined,
        scalePreview: undefined as ScaleDegree[] | undefined 
    };

    const defaultTotal = level.stages.reduce((acc, s) => acc + s.duration, 0);
    const userTotal = userDurationMinutes * 60;
    const scaleFactor = defaultTotal > 0 ? (userTotal / defaultTotal) : 1;

    let timeAccumulator = 0;
    const currentTime = timeRef.current; 

    for (let i = 0; i < level.stages.length; i++) {
      const stage = level.stages[i];
      const scaledDuration = stage.duration * scaleFactor;

      if (currentTime < timeAccumulator + scaledDuration) {
        if (stageLabel !== stage.label) setStageLabel(stage.label);
        
        return { 
            constraints: stage.constraints,
            questionsPerKey: stage.questionsPerKey ?? Infinity,
            introSequence: stage.introSequence,
            scalePreview: stage.scalePreview, 
            stageIndex: i,
            forceTrainingWheels: stage.forceTrainingWheels
        };
      }
      timeAccumulator += scaledDuration;
    }
    
    const lastIndex = level.stages.length - 1;
    const lastStage = level.stages[lastIndex];
    if (stageLabel !== "Level Complete") setStageLabel("Level Complete");
    
    return { 
        constraints: lastStage.constraints,
        questionsPerKey: lastStage.questionsPerKey ?? Infinity,
        introSequence: lastStage.introSequence,
        scalePreview: lastStage.scalePreview, 
        stageIndex: lastIndex
    };
  };

  // ... (keep startTrainingTimer, pauseTrainingTimer, resetTraining exactly the same) ...
  const startTrainingTimer = () => {
    if (!timerInterval.current) {
        timerInterval.current = setInterval(() => {
            timeRef.current += 1;
            setUiSessionTime(timeRef.current); 
        }, 1000);
    }
  };

  const pauseTrainingTimer = () => {
    if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = 0;
    }
  };

  const resetTraining = () => {
    pauseTrainingTimer();
    timeRef.current = 0;
    setUiSessionTime(0);
    setStageLabel("Ready");
  };

  useEffect(() => { return () => pauseTrainingTimer(); }, []);
  useEffect(() => { resetTraining(); }, [activeLevelId]);

  return {
    levels: currentLevels, // EXPORT THIS so UI can see it
    activeLevelId,
    setActiveLevelId,
    sessionTime: uiSessionTime,
    stageLabel,
    userDurationMinutes,
    setUserDurationMinutes,
    getCurrentConfig,
    startTrainingTimer,
    pauseTrainingTimer,
    resetTraining
  };
}