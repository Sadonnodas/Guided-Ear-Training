import { useRef, useCallback, useState } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  ms?: number;
  debug?: boolean;
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

/**
 * SIMPLIFIED v4: Clear separation between touch and mouse with explicit state
 */
export function useLongPress({ 
  onLongPress, 
  onClick, 
  ms = 600,
  debug = false
}: LongPressOptions): LongPressResult {
  
  const timerRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastInteractionWasTouchRef = useRef(false); // NEW: Track if last interaction was touch
  
  const [isLongPressing, setIsLongPressing] = useState(false);

  const log = useCallback((...args: any[]) => {
    if (debug) console.log('[LongPress]', ...args);
  }, [debug]);

  // ===== SHARED START =====
  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const isTouch = 'touches' in e;
    log('START', { isTouch });
    
    if (isActiveRef.current) {
      log('Already active, ignoring');
      return;
    }
    
    // Track if this was a touch event
    lastInteractionWasTouchRef.current = isTouch;
    
    // Only preventDefault for mouse
    if ('button' in e && e.cancelable) {
      e.preventDefault();
    }
    
    // Record position
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
    
    isActiveRef.current = true;
    longPressTriggeredRef.current = false;
    setIsLongPressing(true);
    
    // Start timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    
    timerRef.current = window.setTimeout(() => {
      log('LONG PRESS TRIGGERED');
      longPressTriggeredRef.current = true;
      setIsLongPressing(false);
      onLongPress();
      
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, ms);
  }, [onLongPress, ms, log]);

  // ===== MOUSE HANDLERS =====
  const stopMouse = useCallback(() => {
    log('stopMouse', { 
      active: isActiveRef.current, 
      triggered: longPressTriggeredRef.current,
      lastWasTouch: lastInteractionWasTouchRef.current 
    });
    
    // CRITICAL iOS FIX: Ignore mouse events if last interaction was touch
    // iOS fires mouse events 300ms after touch, causing double-triggering
    if (lastInteractionWasTouchRef.current) {
      log('Ignoring mouse event - last interaction was touch');
      lastInteractionWasTouchRef.current = false; // Reset for next interaction
      return;
    }
    
    if (!isActiveRef.current) return;
    
    // Clear timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    const wasLongPress = longPressTriggeredRef.current;
    
    // Reset
    isActiveRef.current = false;
    longPressTriggeredRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);
    
    // Click only if NOT long press
    if (!wasLongPress) {
      log('Mouse click');
      onClick();
    }
  }, [onClick, log]);

  // ===== TOUCH HANDLERS =====
  const stopTouch = useCallback(() => {
    log('stopTouch', { active: isActiveRef.current, triggered: longPressTriggeredRef.current });
    
    if (!isActiveRef.current) return;
    
    // Check if long press was triggered
    const wasLongPress = longPressTriggeredRef.current;
    
    // Clear timer if still running
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    // Reset
    isActiveRef.current = false;
    longPressTriggeredRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);
    
    // CRITICAL: Only fire onClick if long press did NOT trigger
    if (!wasLongPress) {
      log('Touch tap - calling onClick');
      onClick();
    } else {
      log('Touch after long press - NOT calling onClick');
    }
  }, [onClick, log]);

  // ===== CANCEL =====
  const cancel = useCallback(() => {
    log('CANCEL');
    
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    isActiveRef.current = false;
    longPressTriggeredRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);
  }, [log]);

  // ===== TOUCH MOVE =====
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current || !isActiveRef.current) return;
    
    const touch = e.touches[0];
    const moveThreshold = 50;
    
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      log('Movement threshold exceeded');
      cancel();
    }
  }, [cancel, log]);

  // ===== CONTEXT MENU =====
  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTriggeredRef.current || isLongPressing) {
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