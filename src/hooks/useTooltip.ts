import { useRef, useCallback, useState } from 'react';

interface TooltipOptions {
  tooltipText: string;
  ms?: number;
}

interface TooltipResult {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  isTooltipVisible: boolean;
  tooltipContent: string;
}

export function useTooltip({
  tooltipText,
  ms = 600,
}: TooltipOptions): TooltipResult {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipContent, setTooltipContent] = useState('');
  const timerRef = useRef<number>(0);

  const showTooltip = useCallback(() => {
    setTooltipContent(tooltipText);
    setIsTooltipVisible(true);
  }, [tooltipText]);

  const hideTooltip = useCallback(() => {
    setIsTooltipVisible(false);
    setTooltipContent('');
  }, []);

  const onMouseEnter = showTooltip;
  const onMouseLeave = hideTooltip;

  const onTouchStart = useCallback(() => {
    timerRef.current = window.setTimeout(() => {
      showTooltip();
    }, ms);
  }, [showTooltip, ms]);

  const onTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    // a small delay to allow user to read the tooltip
    setTimeout(() => {
        hideTooltip();
    }, ms)
  }, [hideTooltip, ms]);

  return {
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    isTooltipVisible,
    tooltipContent,
  };
}
