import { useState, useRef, useEffect } from 'react';
import { MAJOR_LEVELS } from '../config/TrainingLevels';
import type { MelodyConstraints } from '../types';

export function useTrainingMode() {
  const [activeLevelId, setActiveLevelId] = useState<number>(1); // Default to Level 1
  const [sessionTime, setSessionTime] = useState(0); 
  const [stageLabel, setStageLabel] = useState("");
  
  const timerRef = useRef<number>(0);

  // Helper to get constraints based on current time
  const getCurrentConstraints = (): MelodyConstraints => {
    const level = MAJOR_LEVELS.find(l => l.id === activeLevelId);
    
    // Fallback if level not found
    if (!level) return { allowedDegrees: ["1"], length: 4 };

    let timeAccumulator = 0;
    
    for (const stage of level.stages) {
      if (sessionTime < timeAccumulator + stage.duration) {
        if (stageLabel !== stage.label) setStageLabel(stage.label);
        return stage.constraints;
      }
      timeAccumulator += stage.duration;
    }
    
    // If time exceeded, return last stage
    const lastStage = level.stages[level.stages.length - 1];
    if (stageLabel !== lastStage.label) setStageLabel(lastStage.label);
    return lastStage.constraints;
  };

  const startTrainingTimer = () => {
    // Only start if not already running
    if (!timerRef.current) {
        timerRef.current = setInterval(() => {
            setSessionTime(t => t + 1);
        }, 1000);
    }
  };

  const pauseTrainingTimer = () => {
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = 0;
    }
  };

  const resetTraining = () => {
    pauseTrainingTimer();
    setSessionTime(0);
    setStageLabel("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => pauseTrainingTimer();
  }, []);

  return {
    activeLevelId,
    setActiveLevelId,
    sessionTime,
    stageLabel,
    getCurrentConstraints,
    startTrainingTimer,
    pauseTrainingTimer,
    resetTraining
  };
}