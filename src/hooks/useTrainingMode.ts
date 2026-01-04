import { useState, useRef, useEffect } from 'react';
import { MAJOR_LEVELS } from '../config/TrainingLevels';
import type { MelodyConstraints } from '../types';

export function useTrainingMode() {
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const activeLevelIdRef = useRef(1); // Fix for Stale Closures
  
  const [uiSessionTime, setUiSessionTime] = useState(0); 
  const [stageLabel, setStageLabel] = useState("");
  
  const timeRef = useRef(0);
  const timerInterval = useRef<number>(0);
  const [userDurationMinutes, setUserDurationMinutes] = useState(5); 

  // Sync Ref with State
  useEffect(() => {
    activeLevelIdRef.current = activeLevelId;
  }, [activeLevelId]);

  const getCurrentConfig = () => {
    // READ FROM REF, NOT STATE
    const currentId = activeLevelIdRef.current;
    const level = MAJOR_LEVELS.find(l => l.id === currentId);
    
    if (!level) return { 
        constraints: { allowedDegrees: ["1"], length: 4 } as MelodyConstraints,
        questionsPerKey: Infinity 
    };

    const defaultTotal = level.stages.reduce((acc, s) => acc + s.duration, 0);
    const userTotal = userDurationMinutes * 60;
    const scaleFactor = defaultTotal > 0 ? (userTotal / defaultTotal) : 1;

    let timeAccumulator = 0;
    const currentTime = timeRef.current; 

    for (const stage of level.stages) {
      const scaledDuration = stage.duration * scaleFactor;
      if (currentTime < timeAccumulator + scaledDuration) {
        if (stageLabel !== stage.label) setStageLabel(stage.label);
        return { 
            constraints: stage.constraints,
            questionsPerKey: stage.questionsPerKey ?? Infinity 
        };
      }
      timeAccumulator += scaledDuration;
    }
    
    const lastStage = level.stages[level.stages.length - 1];
    if (stageLabel !== "Level Complete") setStageLabel("Level Complete");
    
    return { 
        constraints: lastStage.constraints,
        questionsPerKey: lastStage.questionsPerKey ?? Infinity
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

  // Reset timer if level changes (UI side)
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