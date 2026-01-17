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

  const stop = useCallback(() => {
    log('STOP called', { 
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

    // Fire click only if it wasn't a long press AND didn't just fire
    if (!wasLongPress && !justFired) {
      log('Calling onClick()');
      onClick();
    } else {
      log('NOT calling onClick (wasLongPress:', wasLongPress, ', justFired:', justFired, ')');
    }
  }, [onClick, log]);

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
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: handleTouchMove,
    onTouchCancel: cancel,
    onContextMenu: handleContextMenu,
    isLongPressing
  };
}