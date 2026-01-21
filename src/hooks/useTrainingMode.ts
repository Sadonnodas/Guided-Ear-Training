import { useState, useRef, useEffect } from 'react';
import { MAJOR_LEVELS, MINOR_LEVELS, CHROMATIC_LEVELS } from '../config/TrainingLevels';
import type { MelodyConstraints, ScaleDegree, ScaleType, TrainingLevel } from '../types';

const UNLOCK_TIME_SECONDS = 600; // 10 minutes

/**
 * Load level unlock progress from localStorage
 */
function loadLevelProgress(scaleType: ScaleType): Record<number, number> {
  const key = `training_progress_${scaleType}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return { 1: 0 };
    }
  }
  return { 1: 0 }; // Level 1 always starts with 0 time
}

/**
 * Save level unlock progress to localStorage
 */
function saveLevelProgress(scaleType: ScaleType, progress: Record<number, number>) {
  const key = `training_progress_${scaleType}`;
  localStorage.setItem(key, JSON.stringify(progress));
}

export function useTrainingMode(scaleType: ScaleType) {
  
  // 1. Determine which levels array to use
  let currentLevels: TrainingLevel[] = MAJOR_LEVELS;
  if (scaleType === 'Minor') currentLevels = MINOR_LEVELS;
  else if (scaleType === 'Chromatic') currentLevels = CHROMATIC_LEVELS;

  // 2. Load progress for this scale type
  const [levelProgress, setLevelProgress] = useState<Record<number, number>>(() => 
    loadLevelProgress(scaleType)
  );
  
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const activeLevelIdRef = useRef(1);
  
  const [uiSessionTime, setUiSessionTime] = useState(0); 
  const [stageLabel, setStageLabel] = useState("");
  
  const timeRef = useRef(0);
  const timerInterval = useRef<number>(0);
  const [userDurationMinutes, setUserDurationMinutes] = useState(5);
  
  // NEW: Track melodies in Stage 3 for alternating constraints
  const stage3MelodyCountRef = useRef(0);

  useEffect(() => {
    activeLevelIdRef.current = activeLevelId;
  }, [activeLevelId]);

  // When scale type changes, reload progress
  useEffect(() => {
    const newProgress = loadLevelProgress(scaleType);
    setLevelProgress(newProgress);
    
    // If current level isn't unlocked in new scale, go back to level 1
    if (!isLevelUnlocked(activeLevelId, newProgress)) {
      setActiveLevelId(1);
    }
  }, [scaleType]);

  /**
   * Check if a level is unlocked
   */
  const isLevelUnlocked = (levelId: number, progress?: Record<number, number>): boolean => {
    if (levelId === 1) return true; // Level 1 always unlocked
    
    const prog = progress || levelProgress;
    const prevLevelTime = prog[levelId - 1] || 0;
    
    return prevLevelTime >= UNLOCK_TIME_SECONDS;
  };

  /**
   * Get unlock progress for a level (0-100%)
   */
  const getLevelUnlockProgress = (levelId: number): number => {
    if (levelId === 1) return 100; // Always unlocked
    
    const prevLevelTime = levelProgress[levelId - 1] || 0;
    return Math.min(100, (prevLevelTime / UNLOCK_TIME_SECONDS) * 100);
  };

  /**
   * Get time remaining to unlock (in seconds)
   */
  const getTimeToUnlock = (levelId: number): number => {
    if (isLevelUnlocked(levelId)) return 0;
    
    const prevLevelTime = levelProgress[levelId - 1] || 0;
    return UNLOCK_TIME_SECONDS - prevLevelTime;
  };

  /**
   * Get current training configuration with alternating constraints for Stage 3
   */
  const getCurrentConfig = () => {
    const currentId = activeLevelIdRef.current;
    const level = currentLevels.find(l => l.id === currentId);
    
    if (!level) return { 
      constraints: { allowedDegrees: ["1"] as ScaleDegree[], length: 4 } as MelodyConstraints,
      questionsPerKey: Infinity,
      stageIndex: -1,
      introSequence: undefined as ScaleDegree[] | undefined,
      scalePreview: undefined as ScaleDegree[] | undefined,
      forceTrainingWheels: false,
      focusedDegree: undefined as ScaleDegree | undefined
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
        if (stageLabel !== stage.label) {
          setStageLabel(stage.label);
          
          // Reset Stage 3 counter when entering Stage 3
          if (i === 2) {
            stage3MelodyCountRef.current = 0;
          }
        }
        
        // HANDLE STAGE 3 ALTERNATING CONSTRAINTS
        let constraints = { ...stage.constraints };
        
        if (stage.alternatingConstraints) {
          // Every 3 melodies, alternate between:
          // - Start on "1", End = any
          // - Start = any, End on "1"
          const cycle = Math.floor(stage3MelodyCountRef.current / 3) % 2;
          
          if (cycle === 0) {
            // Melodies 0-2, 6-8, 12-14: Start on "1"
            constraints.startDegree = "1";
            constraints.endDegree = undefined;
          } else {
            // Melodies 3-5, 9-11, 15-17: End on "1"
            constraints.startDegree = undefined;
            constraints.endDegree = "1";
          }
        }
        
        return { 
          constraints,
          questionsPerKey: stage.questionsPerKey ?? Infinity,
          introSequence: stage.introSequence,
          scalePreview: stage.scalePreview, 
          stageIndex: i,
          forceTrainingWheels: stage.forceTrainingWheels,
          focusedDegree: stage.focusedDegree
        };
      }
      timeAccumulator += scaledDuration;
    }
    
    // Level complete
    const lastIndex = level.stages.length - 1;
    const lastStage = level.stages[lastIndex];
    if (stageLabel !== "Level Complete") setStageLabel("Level Complete");
    
    return { 
      constraints: lastStage.constraints,
      questionsPerKey: lastStage.questionsPerKey ?? Infinity,
      introSequence: lastStage.introSequence,
      scalePreview: lastStage.scalePreview, 
      stageIndex: lastIndex,
      forceTrainingWheels: lastStage.forceTrainingWheels,
      focusedDegree: lastStage.focusedDegree
    };
  };

  /**
   * Increment Stage 3 melody counter
   */
  const incrementStage3Counter = () => {
    stage3MelodyCountRef.current += 1;
  };

  /**
   * Start the training timer and track progress
   */
  const startTrainingTimer = () => {
    if (!timerInterval.current) {
      timerInterval.current = window.setInterval(() => {
        timeRef.current += 1;
        setUiSessionTime(timeRef.current);
        
        // Update level progress every second
        const currentId = activeLevelIdRef.current;
        setLevelProgress(prev => {
          const newProgress = {
            ...prev,
            [currentId]: (prev[currentId] || 0) + 1
          };
          saveLevelProgress(scaleType, newProgress);
          return newProgress;
        });
      }, 1000);
    }
  };

  const pauseTrainingTimer = () => {
    if (timerInterval.current) {
      window.clearInterval(timerInterval.current);
      timerInterval.current = 0;
    }
  };

  const resetTraining = () => {
    pauseTrainingTimer();
    timeRef.current = 0;
    setUiSessionTime(0);
    setStageLabel("Ready");
    stage3MelodyCountRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => { 
    return () => pauseTrainingTimer(); 
  }, []);
  
  // Reset when changing levels
  useEffect(() => { 
    resetTraining(); 
  }, [activeLevelId]);

  /**
   * Attempt to select a level (blocks if locked)
   */
  const handleLevelChange = (levelId: number) => {
    if (isLevelUnlocked(levelId)) {
      setActiveLevelId(levelId);
    }
  };

  return {
    levels: currentLevels,
    activeLevelId,
    setActiveLevelId: handleLevelChange, // Use gated version
    sessionTime: uiSessionTime,
    stageLabel,
    userDurationMinutes,
    setUserDurationMinutes,
    getCurrentConfig,
    startTrainingTimer,
    pauseTrainingTimer,
    resetTraining,
    incrementStage3Counter,
    
    // NEW: Unlock system
    isLevelUnlocked,
    getLevelUnlockProgress,
    getTimeToUnlock,
    levelProgress
  };
}