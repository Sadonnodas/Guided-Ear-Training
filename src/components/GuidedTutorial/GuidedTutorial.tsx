import { useState, useEffect, useRef } from 'react';
import './GuidedTutorial.css';

interface TutorialStep {
  target: string;
  title: string;
  points: string[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
  smartPosition?: boolean;
  action?: {
    hint: string;
    check?: () => boolean;
  };
  switchToTab?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: '.tabs',
    title: '🎵 Welcome to Guided Ear Training!',
    points: [
      'Three practice modes to choose from',
      'Random: Freeform practice with full control',
      'Training: Structured curriculum (next step!)',
      'Fretboard: Guitar CAGED shapes (we\'ll explain later)',
      '💡 Hover over each tab to see what it does'
    ],
    position: 'bottom',
    highlightPadding: 15
  },
  {
    target: '.info-display',
    title: '🎼 Scale & Key Selection',
    points: [
      'Choose your scale type (Major, Minor, Pentatonic)',
      'Select the musical key to practice in',
      'Shuffle button picks a random key',
      'Switch between Tape (scrolling) and Static (grid) views',
      'All melodies will be generated in your selected key'
    ],
    position: 'bottom',
    highlightPadding: 20
  },
  {
    target: '.play-btn-container',
    title: '▶️ Start Practicing',
    points: [
      'Press Play to begin your session',
      'Session flow: Listen → Sing Along → Your Turn',
      'Pause anytime to take a break',
      'Stop button resets the current session'
    ],
    position: 'top',
    highlightPadding: 20,
    smartPosition: true
  },
  {
    target: '.visualizer-container, .degree-grid',
    title: '👁️ Visual Feedback & Scale Degrees',
    points: [
      'Watch notes scroll/light up as melodies play',
      '🎯 Try it: Click on a degree to enable or disable it',
      '⏱️ Try it: Long-press (600ms) a degree to FOCUS on it',
      'Focused degrees appear more frequently in melodies',
      '💡 Hover over degrees for click/long-press instructions'
    ],
    position: 'top',
    highlightPadding: 25,
    action: {
      hint: 'Try clicking or long-pressing a scale degree!'
    }
  },
  {
    target: '.tabs button:nth-child(2)',
    title: '📚 Training Mode Explained',
    points: [
      'Structured curriculum with progressive levels',
      'Each level introduces ONE new scale degree',
      'Four stages per level: Introduction → Practice → Integration → Mastery',
      'Spend 10 minutes in a level to unlock the next one',
      'Perfect for systematic ear training development'
    ],
    position: 'bottom',
    highlightPadding: 15,
    switchToTab: 'training'
  },
  {
    target: '.tabs button:nth-child(3)',
    title: '🎸 Fretboard Mode Explained',
    points: [
      'Guitar-specific practice using CAGED system',
      'Practice scale shapes across the fretboard',
      'Visual fretboard shows note positions',
      'Switch between shapes (C, A, G, E, D)',
      'Helps guitarists associate scale degrees with positions in specific CAGED shapes'
    ],
    position: 'bottom',
    highlightPadding: 15,
    switchToTab: 'fretboard'
  },
  {
    target: '.settings-trigger',
    title: '⚙️ Customize Everything',
    points: [
      'Open to access all control settings',
      'Four tabs: Melody, Rhythm, Mixer, and More',
      'Adjust difficulty, tempo, vocal range, and audio levels',
      'Enable special modes: Pitch Guide, Inverse, or Blind',
      '💡 Hover over any button for helpful tooltips!'
    ],
    position: 'top',
    highlightPadding: 15,
    switchToTab: 'random'
  }
];

interface GuidedTutorialProps {
  onComplete?: () => void;
  onTabChange?: (tab: string) => void;
}

export default function GuidedTutorial({ onComplete, onTabChange }: GuidedTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem('tutorial-completed');
    if (!completed) {
      setTimeout(() => setIsActive(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const step = TUTORIAL_STEPS[currentStep];
    
    if (step.switchToTab && onTabChange) {
      onTabChange(step.switchToTab);
      setTimeout(() => updateHighlight(), 100);
    } else {
      updateHighlight();
    }
  }, [currentStep, isActive]);

  const updateHighlight = () => {
    const step = TUTORIAL_STEPS[currentStep];
    const selectors = step.target.split(',').map(s => s.trim());
    
    let element: HTMLElement | null = null;
    for (const selector of selectors) {
      element = document.querySelector(selector) as HTMLElement;
      if (element) break;
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const padding = step.highlightPadding || 10;

      setPosition({
        top: rect.top + scrollY - padding,
        left: rect.left + scrollX - padding,
        width: rect.width + (padding * 2),
        height: rect.height + (padding * 2)
      });

      if (overlayRef.current) {
        overlayRef.current.style.setProperty('--target-top', `${rect.top + scrollY - padding}px`);
        overlayRef.current.style.setProperty('--target-left', `${rect.left + scrollX - padding}px`);
        overlayRef.current.style.setProperty('--target-width', `${rect.width + (padding * 2)}px`);
        overlayRef.current.style.setProperty('--target-height', `${rect.height + (padding * 2)}px`);
      }

      let finalPosition = step.position || 'bottom';
      
      if (step.smartPosition) {
        const viewportHeight = window.innerHeight;
        const elementCenter = rect.top + (rect.height / 2);
        
        if (elementCenter > viewportHeight / 2 && finalPosition === 'bottom') {
          finalPosition = 'top';
        }
      }
      
      setTooltipPosition(finalPosition);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // IMPROVED: Check if click is on backdrop (not on highlighted element or tooltip)
  const handleBackdropClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Only close if clicking directly on the backdrop
    if (target.classList.contains('tutorial-backdrop')) {
      handleSkip();
    }
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    localStorage.setItem('tutorial-completed', 'true');
    setIsActive(false);
    if (onComplete) onComplete();
  };

  if (!isActive) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <div className="tutorial-overlay" ref={overlayRef}>
      {/* IMPROVED: Click handler only triggers on backdrop itself */}
      <div className="tutorial-backdrop" onClick={handleBackdropClick} />
      
      {/* Highlighted element area - clicks pass through */}
      <div 
        className="tutorial-highlight"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height,
          pointerEvents: 'none' // CRITICAL: Allow clicks to pass through
        }}
      />

      <div 
        className={`tutorial-tooltip tooltip-${tooltipPosition}`}
        style={{
          top: position.top + (position.height / 2),
          left: position.left + (position.width / 2)
        }}
      >
        <div className="tooltip-header">
          <h3 className="tooltip-title">{step.title}</h3>
          <button className="tooltip-close" onClick={handleSkip}>×</button>
        </div>

        <ul className="tooltip-points">
          {step.points.map((point, idx) => (
            <li key={idx}>{point}</li>
          ))}
        </ul>

        {step.action && (
          <div className="tooltip-action">
            <div className="action-hint">💡 {step.action.hint}</div>
          </div>
        )}

        <div className="tooltip-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="tooltip-nav">
          <button 
            className="nav-btn nav-skip" 
            onClick={handleSkip}
          >
            Skip Tutorial
          </button>

          <div className="nav-controls">
            <button 
              className="nav-btn nav-prev" 
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              ← Back
            </button>

            <span className="step-counter">
              {currentStep + 1} / {TUTORIAL_STEPS.length}
            </span>

            <button 
              className="nav-btn nav-next" 
              onClick={handleNext}
            >
              {currentStep === TUTORIAL_STEPS.length - 1 ? '✓ Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}