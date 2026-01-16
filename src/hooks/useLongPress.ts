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
  isLongPressing: boolean;
}

/**
 * Custom hook for handling both click and long-press interactions.
 * Optimized for mobile with proper touch handling.
 * 
 * @param onLongPress - Callback fired on long press (default 350ms)
 * @param onClick - Callback fired on short click/tap
 * @param ms - Long press duration in milliseconds (default 350)
 */
export function useLongPress({ 
  onLongPress, 
  onClick, 
  ms = 350 
}: LongPressOptions): LongPressResult {
  
  const timerRef = useRef<number>(0);
  const isLongPressRef = useRef(false);
  const isStartedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Track long-press state for visual feedback
  const [isLongPressing, setIsLongPressing] = useState(false);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to avoid text selection and context menus
    if (e.cancelable) {
      e.preventDefault();
    }
    
    // Record starting position for touch move detection
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
        setIsLongPressing(false);
        onLongPress();
        
        // Optional: Add haptic feedback on supported devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, ms);
    
    // Show visual feedback that long press is in progress
    setIsLongPressing(true);
  }, [onLongPress, ms]);

  const stop = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (!isStartedRef.current) return;
    
    // Prevent ghost clicks on mobile
    if (e && e.cancelable) {
      e.preventDefault();
    }

    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    
    const wasLongPress = isLongPressRef.current;
    
    isStartedRef.current = false;
    isLongPressRef.current = false;
    startPosRef.current = null;
    setIsLongPressing(false);

    // Fire click only if it wasn't a long press
    if (!wasLongPress) {
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
    // If the user moves their finger significantly, cancel the long press
    // This prevents accidental long presses while scrolling
    if (!startPosRef.current || !isStartedRef.current) return;
    
    const touch = e.touches[0];
    const moveThreshold = 10; // pixels
    
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      cancel();
    }
  }, [cancel]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: handleTouchMove,
    onTouchCancel: cancel,
    isLongPressing
  };
}