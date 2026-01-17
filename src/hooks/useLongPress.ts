import { useRef, useCallback, useState } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  ms?: number;
  debug?: boolean; // Add debug flag
}

interface LongPressResult {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent) => void;
  isLongPressing: boolean;
}

export function useLongPress({ 
  onLongPress, 
  onClick, 
  ms = 600,
  debug = false
}: LongPressOptions): LongPressResult {
  
  const timerRef = useRef<number>(0);
  const isLongPressRef = useRef(false);
  const isStartedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressJustFiredRef = useRef(false);
  const stopAlreadyCalledRef = useRef(false); // NEW: Prevent double-stop
  
  const [isLongPressing, setIsLongPressing] = useState(false);

  const log = useCallback((...args: any[]) => {
    if (debug) console.log('[LongPress]', ...args);
  }, [debug]);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    log('START', { isStarted: isStartedRef.current });
    
    // Prevent starting if already started
    if (isStartedRef.current) {
      log('START: Already started, ignoring');
      return;
    }
    
    // MINIMAL preventDefault - only for mouse to prevent text selection
    if ('button' in e && e.cancelable) {
      e.preventDefault();
    }
    
    // Record starting position
    if ('touches' in e && e.touches.length > 0) {
      startPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else if ('clientX' in e) {
      startPosRef.current = {
        x: e.clientX,
        y: e.clientY
      };
    }
    
    isStartedRef.current = true;
    isLongPressRef.current = false;
    longPressJustFiredRef.current = false;
    stopAlreadyCalledRef.current = false;
    
    // Clear any existing timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    
    timerRef.current = window.setTimeout(() => {
      log('TIMER FIRED');
      if (isStartedRef.current) {
        isLongPressRef.current = true;
        longPressJustFiredRef.current = true;
        setIsLongPressing(false);
        
        log('Calling onLongPress()');
        onLongPress();
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        // Reset the flag after a delay
        setTimeout(() => {
          longPressJustFiredRef.current = false;
          log('Guard flag cleared');
        }, 200); // Increased to 200ms
      }
    }, ms);
    
    // Show visual feedback
    setIsLongPressing(true);
  }, [onLongPress, ms, log]);

  const stop = useCallback((isMouse: boolean = false) => {
    log('STOP called', { 
      isMouse,
      isStarted: isStartedRef.current, 
      wasLongPress: isLongPressRef.current,
      justFired: longPressJustFiredRef.current,
      alreadyCalled: stopAlreadyCalledRef.current
    });
    
    if (!isStartedRef.current) {
      log('STOP: Not started, ignoring');
      return;
    }
    
    // Prevent double-stop
    if (stopAlreadyCalledRef.current) {
      log('STOP: Already called, ignoring');
      return;
    }
    stopAlreadyCalledRef.current = true;
    
    // Clear the timer if it's still running
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    // Check if this was a long press BEFORE resetting
    const wasLongPress = isLongPressRef.current;
    const justFired = longPressJustFiredRef.current;
    
    // Reset all state
    isStartedRef.current = false;
    isLongPressRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);

    // CRITICAL FIX: Only fire onClick if:
    // 1. It's a mouse event (clicks should toggle immediately), OR
    // 2. It's a touch AND it wasn't a long press AND didn't just fire
    // 
    // For touch events after long press, we DON'T want onClick to fire
    const shouldFireClick = isMouse 
      ? !wasLongPress && !justFired  // Mouse: normal behavior
      : false;                        // Touch: NEVER fire onClick on touchEnd
                                      // (touch toggles happen on short taps that clear the timer)
    
    if (shouldFireClick && !wasLongPress && !justFired) {
      log('Calling onClick()');
      onClick();
    } else {
      log('NOT calling onClick', { shouldFireClick, wasLongPress, justFired });
    }
  }, [onClick, log]);

  // Mouse-specific stop handler
  const stopMouse = useCallback(() => {
    stop(true);
  }, [stop]);

  // Touch-specific stop handler  
  const stopTouch = useCallback(() => {
    // For touch: only call onClick if the timer is still running (short tap)
    // If timer already fired (long press), just clean up
    const timerStillRunning = timerRef.current !== 0;
    
    log('stopTouch', { timerStillRunning, wasLongPress: isLongPressRef.current });
    
    if (timerStillRunning) {
      // Short tap - cancel timer and fire onClick
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
      
      isStartedRef.current = false;
      isLongPressRef.current = false;
      startPosRef.current = null;
      setIsLongPressing(false);
      stopAlreadyCalledRef.current = true;
      
      log('Short tap - calling onClick');
      onClick();
    } else {
      // Long press already fired - just clean up
      stop(false);
    }
  }, [stop, onClick, log]);

  const cancel = useCallback(() => {
    log('CANCEL');
    
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    isStartedRef.current = false;
    isLongPressRef.current = false;
    startPosRef.current = null;
    longPressJustFiredRef.current = false;
    stopAlreadyCalledRef.current = false;
    setIsLongPressing(false);
  }, [log]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current || !isStartedRef.current) return;
    
    const touch = e.touches[0];
    const moveThreshold = 50;
    
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      log('MOVE: Threshold exceeded, canceling');
      cancel();
    }
  }, [cancel, log]);

  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isLongPressRef.current || isLongPressing) {
      e.preventDefault();
    }
  }, [isLongPressing]);

  return {
    onMouseDown: start,
    onMouseUp: stopMouse,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stopTouch,
    onTouchMove: handleTouchMove,
    onTouchCancel: cancel,
    onContextMenu: handleContextMenu,
    isLongPressing
  };
}