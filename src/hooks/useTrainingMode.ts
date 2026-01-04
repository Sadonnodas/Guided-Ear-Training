import { useState, useRef, useEffect } from 'react';
import { MAJOR_LEVELS } from '../config/TrainingLevels';
import type { MelodyConstraints, ScaleDegree } from '../types';

export function useTrainingMode() {
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

  const getCurrentConfig = () => {
    const currentId = activeLevelIdRef.current;
    const level = MAJOR_LEVELS.find(l => l.id === currentId);
    
    // Default fallback
    if (!level) return { 
        constraints: { allowedDegrees: ["1"], length: 4 } as MelodyConstraints,
        questionsPerKey: Infinity,
        stageIndex: -1,
        introSequence: undefined as ScaleDegree[] | undefined,
        scalePreview: undefined as ScaleDegree[] | undefined // FIX: Added this
    };

    const defaultTotal = level.stages.reduce((acc, s) => acc + s.duration, 0);
    const userTotal = userDurationMinutes * 60;
    const scaleFactor = defaultTotal > 0 ? (userTotal / defaultTotal) : 1;

    let timeAccumulator = 0;
    const currentTime = timeRef.current; 

    // Find Active Stage
    for (let i = 0; i < level.stages.length; i++) {
      const stage = level.stages[i];
      const scaledDuration = stage.duration * scaleFactor;

      if (currentTime < timeAccumulator + scaledDuration) {
        if (stageLabel !== stage.label) setStageLabel(stage.label);
        
        return { 
            constraints: stage.constraints,
            questionsPerKey: stage.questionsPerKey ?? Infinity,
            introSequence: stage.introSequence,
            scalePreview: stage.scalePreview, // FIX: Added this
            stageIndex: i
        };
      }
      timeAccumulator += scaledDuration;
    }
    
    // Last Stage
    const lastIndex = level.stages.length - 1;
    const lastStage = level.stages[lastIndex];
    if (stageLabel !== "Level Complete") setStageLabel("Level Complete");
    
    return { 
        constraints: lastStage.constraints,
        questionsPerKey: lastStage.questionsPerKey ?? Infinity,
        introSequence: lastStage.introSequence,
        scalePreview: lastStage.scalePreview, // FIX: Added this
        stageIndex: lastIndex
    };
  };

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

  useEffect(() => {
    return () => pauseTrainingTimer();
  }, []);

  useEffect(() => {
    resetTraining();
  }, [activeLevelId]);

  return {
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