import { useState, useEffect, useRef } from 'react';
import './GuidedTutorial.css';

interface TutorialStep {
  target: string;
  title: string;
  points: string[]; // Structured bullet points instead of paragraph
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number; // Extra padding around highlight
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: '.tabs',
    title: '🎵 Welcome to Guided Ear Training!',
    points: [
      'Three practice modes available',
      'Random: Freeform practice with any scale degree',
      'Training: Structured curriculum with progressive levels',
      'Fretboard: Guitar-specific CAGED shape training'
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
      'Restart button resets the current session'
    ],
    position: 'top',
    highlightPadding: 20
  },
  {
    target: '.visualizer-container, .degree-grid',
    title: '👁️ Visual Feedback',
    points: [
      'Watch notes scroll by as melodies play',
      'Click/tap degrees to enable or disable them',
      'Long-press (600ms) to focus on specific degrees',
      'Focused degrees appear more frequently in practice'
    ],
    position: 'top',
    highlightPadding: 25
  },
  {
    target: '.settings-trigger',
    title: '⚙️ Customize Everything',
    points: [
      'Adjust melody difficulty (Easy/Normal/Hard)',
      'Set tempo and drum patterns',
      'Configure your vocal range',
      'Mix audio levels to your preference',
      'Enable Pitch Guide, Inverse Mode, or Blind Mode'
    ],
    position: 'top',
    highlightPadding: 15
  }
];

interface GuidedTutorialProps {
  onComplete?: () => void;
}

export default function GuidedTutorial({ onComplete }: GuidedTutorialProps) {
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
    const selectors = step.target.split(',').map(s => s.trim());
    
    // Try each selector until we find one
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

      setTooltipPosition(step.position || 'bottom');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isActive]);

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
      <div className="tutorial-backdrop" onClick={handleSkip} />
      
      <div 
        className="tutorial-highlight"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          height: position.height
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