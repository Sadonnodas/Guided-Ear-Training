import { useRef, useCallback } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  onClick: () => void;
  ms?: number;
}

export function useLongPress({ onLongPress, onClick, ms = 500 }: LongPressOptions) {
  const timerRef = useRef<number>(0);
  const isLongPress = useRef(false);
  const isStarted = useRef(false);

  // Removed unused 'e' parameter
  const start = useCallback(() => {
    isStarted.current = true;
    isLongPress.current = false;
    
    timerRef.current = window.setTimeout(() => {
      if (isStarted.current) {
        isLongPress.current = true;
        onLongPress();
      }
    }, ms);
  }, [onLongPress, ms]);

  // Removed unused 'e' parameter
  const stop = useCallback(() => {
    if (!isStarted.current) return;

    clearTimeout(timerRef.current);
    isStarted.current = false;

    if (!isLongPress.current) {
      onClick();
    }
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}