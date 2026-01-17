import { useRef, useCallback, useState } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  ms?: number;
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
 * ULTRA-ROBUST v3: Mobile-first long press with maximum forgiveness
 * 
 * Key improvements:
 * - 600ms duration (very deliberate)
 * - 50px movement threshold (extremely forgiving)
 * - Minimal preventDefault (only what's absolutely necessary)
 * - Works on disabled elements
 */
export function useLongPress({ 
  onLongPress, 
  onClick, 
  ms = 600 // VERY deliberate - hard to trigger accidentally
}: LongPressOptions): LongPressResult {
  
  const timerRef = useRef<number>(0);
  const isLongPressRef = useRef(false);
  const isStartedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressJustFiredRef = useRef(false); // NEW: Prevent click after long press
  
  // Track long-press state for visual feedback
  const [isLongPressing, setIsLongPressing] = useState(false);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
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
    
    // Clear any existing timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    
    timerRef.current = window.setTimeout(() => {
      if (isStartedRef.current) {
        isLongPressRef.current = true;
        longPressJustFiredRef.current = true; // NEW: Mark that long press fired
        setIsLongPressing(false);
        onLongPress();
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        
        // Reset the flag after a short delay to prevent onClick
        setTimeout(() => {
          longPressJustFiredRef.current = false;
        }, 100);
      }
    }, ms);
    
    // Show visual feedback
    setIsLongPressing(true);
  }, [onLongPress, ms]);

  const stop = useCallback(() => {
    if (!isStartedRef.current) return;
    
    // DON'T preventDefault on touch events - let natural behavior happen
    
    // Clear the timer if it's still running
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    
    // CRITICAL: Check if this was a long press BEFORE resetting the flag
    const wasLongPress = isLongPressRef.current;
    const justFired = longPressJustFiredRef.current;
    
    // Reset all state
    isStartedRef.current = false;
    isLongPressRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);

    // Fire click only if:
    // 1. It wasn't a long press, AND
    // 2. A long press didn't just fire (prevents race condition)
    if (!wasLongPress && !justFired) {
      onClick();
    }
  }, [onClick]);

  const cancel = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    isStartedRef.current = false;
    isLongPressRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // EXTREMELY forgiving - 50px threshold
    if (!startPosRef.current || !isStartedRef.current) return;
    
    const touch = e.touches[0];
    const moveThreshold = 50; // VERY forgiving!
    
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    
    // Only cancel on major movement (scrolling)
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      cancel();
    }
  }, [cancel]);

  // Handle context menu
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