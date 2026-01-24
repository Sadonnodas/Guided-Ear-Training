import { useState, useEffect, useRef } from 'react';
import './GuidedTutorial.css';

// Detect mobile
const isMobile = () => window.innerWidth <= 600;

interface TutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  points?: string[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
  customPadding?: { top: number; right: number; bottom: number; left: number };
  combinedTarget?: boolean; // NEW: Calculate bounding box of ALL matched elements
  smartPosition?: boolean;
  action?: {
    hint: string;
    check?: () => boolean;
  };
  switchToTab?: string;
  waitForLayout?: boolean;
  hasSubsteps?: boolean;
  openControls?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  // STEP 1: Welcome (with substeps)
  {
    id: '1',
    target: '.tabs',
    title: '🎵 Welcome to Guided Ear Training!',
    description: 'Three practice modes to choose from. Each mode has a different learning approach.',
    points: [
      '💡 Hover over each tab to see what it does',
      'Want to learn more about each mode? Click "Learn More"'
    ],
    position: 'bottom',
    highlightPadding: 15,
    hasSubsteps: true
  },
  {
    id: '1.1',
    target: '.tabs button:nth-child(1)',
    title: '🎲 Random Mode',
    description: 'Freeform practice with complete control over scale degrees, difficulty, and all settings. Perfect for focused practice on specific intervals or general practice on all degrees.',
    position: 'bottom',
    highlightPadding: 8
  },
  {
    id: '1.2',
    target: '.tabs button:nth-child(2)',
    title: '📚 Training Mode',
    description: 'Structured curriculum that introduces one scale degree at a time. Four progressive stages per level automatically increase the difficulty. After 10 minutes of practice, the next level unlocks.',
    position: 'bottom',
    highlightPadding: 8
  },
  {
    id: '1.3',
    target: '.tabs button:nth-child(3)',
    title: '🎸 Fretboard Mode',
    description: 'Guitar-specific practice using the CAGED system. Associates scale degrees with fretboard positions in each shape (C, A, G, E, D).',
    position: 'bottom',
    highlightPadding: 8
  },
  
  // STEP 2: Scale & Key (with substeps)
  {
    id: '2',
    target: '.info-display',
    title: '🎼 Scale & Key Selection',
    description: 'Control what you practice and how it looks. All generated melodies will follow your settings.',
    position: 'bottom',
    highlightPadding: 20,
    waitForLayout: true,
    hasSubsteps: true
  },
  {
    id: '2.1',
    target: '.key-container select:first-of-type',
    title: '🎹 Scale Type',
    description: 'Choose Major, Minor, or Pentatonic scales. Each has different scale degrees to learn. In the Training tab we only work on Major or Minor.',
    position: 'bottom',
    highlightPadding: 8,
    waitForLayout: true
  },
  // Target BOTH key selector AND shuffle button - code will calculate combined bounding box
  {
    id: '2.2',
    target: '.key-container select:nth-of-type(2), .key-container button',
    title: '🔑 Musical Key',
    description: 'Select which key to practice in (C, D, E, etc.). Click the shuffle button for random key selection.',
    position: 'bottom',
    highlightPadding: 5,
    combinedTarget: true, // NEW: Signal to calculate bounding box of ALL matched elements
    waitForLayout: true
  },
  {
    id: '2.3',
    target: '.view-toggle',
    title: '📺 View Mode',
    description: 'Tape view scrolls notes horizontally, following the melody. Static view shows all degrees in a fixed grid. Choose what helps you learn best!',
    position: 'bottom',
    highlightPadding: 8,
    waitForLayout: true
  },
  
  // STEP 3: Visual Feedback (MOVED BEFORE Play Button - FIX #5)
  {
    id: '3',
    target: '.visualizer-container, .degree-grid',
    title: '👁️ Visual Feedback & Scale Degrees',
    description: 'Watch notes scroll/light up as melodies play.',
    points: [
      '🎯 Try it: Click on a degree to enable or disable it',
      '⏱️ Try it: Long-press (600ms) a degree to FOCUS on it'
    ],
    position: 'bottom',
    highlightPadding: 5,
    action: {
      hint: 'Try clicking or long-pressing a scale degree!'
    },
    hasSubsteps: true
  },
  // Target the visualizer container as a whole for this step (degree 1 might not be rendered yet)
  {
    id: '3.1',
    target: '.visualizer-container',
    title: '🔴 Scale Degree 1 (Root)',
    description: 'The tonic or home note. Always the most stable and restful sound in any key. This is your anchor point. Look for the orange/red colored degree labeled "1" in the visualizer.',
    position: 'bottom',
    highlightPadding: 10
  },
  {
    id: '3.2',
    target: '.visualizer-container, .degree-grid',
    title: '🎨 Color Coding',
    description: 'Each scale degree has a unique color. Root (1) is always orange/red for easy recognition. This helps you identify intervals visually.',
    position: 'bottom',
    highlightPadding: 5
  },
  {
    id: '3.3',
    target: '.visualizer-container',
    title: '🎯 Focus Mode',
    description: 'Long-press any degree to put it into focus. The generated melody will always include this degree. Perfect for a more targeted practice. The focused degree will have a yellow border. Maximum 2 focused degrees at a time.',
    position: 'bottom',
    highlightPadding: 5
  },
  
  // STEP 4: Play Button (NOW AFTER Visual Feedback - FIX #5)
  {
    id: '4',
    target: '.play-btn-container',
    title: '▶️ Start Practicing',
    description: 'Press Play to begin. The ear training works in 3 phases: Listen, Sing, and Your Turn.',
    position: 'top',
    highlightPadding: 20,
    smartPosition: true,
    hasSubsteps: true
  },
  {
    id: '4.1',
    target: '.play-btn-container',
    title: '👂 Listen Phase',
    description: 'A melody, consisting of 4 notes, will be played. Pay attention to the intervals and scale degrees. This builds your inner hearing. The corresponding scale degrees light up as a visual guide.',
    position: 'top',
    highlightPadding: 20,
    smartPosition: true
  },
  {
    id: '4.2',
    target: '.play-btn-container',
    title: '🎤 Sing Along Phase',
    description: 'The melody gets repeated. Sing along with it. Practice matching pitch and notice how each scale degree feels against the drone note.',
    position: 'top',
    highlightPadding: 20,
    smartPosition: true
  },
  {
    id: '4.3',
    target: '.play-btn-container',
    title: '✨ Your Turn Phase',
    description: 'Sing without the melody to internalize the scale degrees even more. Toggle on Pitch Guide in the controls to get a synth playing along in this phase.',
    position: 'top',
    highlightPadding: 20,
    smartPosition: true
  },
  
  // STEP 5: Training Mode
  {
    id: '5',
    target: '.tabs button:nth-child(2)',
    title: '📚 Training Mode Explained',
    description: 'Structured curriculum with progressive levels. Each level introduces ONE new scale degree. Spend 10 minutes in a level to unlock the next one.',
    points: [
      'Four stages per level, increasing in difficulty',
      'Perfect for systematic ear training development'
    ],
    position: 'bottom',
    highlightPadding: 20,
    switchToTab: 'training',
    waitForLayout: true
  },
  
  // STEP 6: Fretboard Mode
  {
    id: '6',
    target: '.tabs button:nth-child(3)',
    title: '🎸 Fretboard Mode Explained',
    description: 'Guitar-specific practice using CAGED system. Practice scale shapes across the fretboard. Switch between shapes (C, A, G, E, D).',
    points: [
      'Visual fretboard shows note positions as melodies play',
      'Inverse mode enabled by default: Listen first, then play along and see answer',
      'Quick tip: Use Blind Mode (in the controls) to hide visuals during listen phase for extra challenge!',
    ],
    position: 'bottom',
    highlightPadding: 15,
    switchToTab: 'fretboard',
    waitForLayout: true
  },
  
  // STEP 7: Controls (with substeps)
  {
    id: '7',
    target: '.settings-trigger',
    title: '⚙️ Customize Everything',
    description: 'Click here to open the control settings. Four tabs with different options.',
    points: [
      '💡 Hover over any button for helpful tooltips!'
    ],
    position: 'top',
    highlightPadding: 15,
    switchToTab: 'random',
    waitForLayout: true,
    hasSubsteps: true
  },
  {
    id: '7.1',
    target: '.settings-trigger',
    title: '🎼 Melody Controls',
    description: 'Difficulty (easiest to hard), tempo, root note constraints, and vocal range calibration. Control how melodies are generated.',
    position: 'top',
    highlightPadding: 15
  },
  {
    id: '7.2',
    target: '.settings-trigger',
    title: '🥁 Rhythm Controls',
    description: 'Choose from 9 drum patterns across 3 styles: Classic, Lofi Chill, Bossa Vibe, and Percussion Only. Find a groove that works for you.',
    position: 'top',
    highlightPadding: 15
  },
  {
    id: '7.3',
    target: '.settings-trigger',
    title: '🎚️ Mixer Controls',
    description: 'Adjust volume for vocals, drums, drone, metronome, training synth, and master output. Add reverb for space. Create your perfect mix.',
    position: 'top',
    highlightPadding: 15
  },
  {
    id: '7.4',
    target: '.settings-trigger',
    title: '🔧 Advanced Modes',
    description: 'Pitch Guide, Inverse Mode (hear then sing), Blind Mode (hide visuals during listen). Experiment with these!',
    position: 'top',
    highlightPadding: 15
  },
  // NEW: Step 7.5 - Pro Tip for Inverse + Blind Mode
  {
    id: '7.5',
    target: '[title*="Inverse Mode"], [title*="Blind Mode"]',
    title: '💡 Pro Tip: Test Yourself!',
    description: 'Use Inverse Mode together with Blind Mode to challenge yourself. You will hear the melody played twice by synth, then on the third time the scale degrees appear. Try to identify them before they are shown!',
    position: 'top',
    highlightPadding: 10,
    combinedTarget: true, // Calculate bounding box of both buttons
    openControls: true // Signal that controls should be open for this step
  }
];

interface GuidedTutorialProps {
  onComplete?: () => void;
  onTabChange?: (tab: string) => void;
}

export default function GuidedTutorial({ onComplete, onTabChange }: GuidedTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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

    const step = TUTORIAL_STEPS[currentStepIndex];
    
    if (step.switchToTab && onTabChange) {
      onTabChange(step.switchToTab);
      
      if (step.waitForLayout) {
        setTimeout(() => updateHighlight(), 150);
        const checks = [200, 300, 400, 500];
        checks.forEach(delay => {
          setTimeout(() => updateHighlight(), delay);
        });
      } else {
        setTimeout(() => updateHighlight(), 100);
      }
    } else {
      updateHighlight();
    }
    
    const handleResize = () => updateHighlight();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentStepIndex, isActive]);

  const updateHighlight = () => {
    const step = TUTORIAL_STEPS[currentStepIndex];
    const selectors = step.target.split(',').map(s => s.trim());
    
    // NEW: If combinedTarget is true, get ALL matching elements and calculate combined bounding box
    if (step.combinedTarget) {
      const elements: HTMLElement[] = [];
      for (const selector of selectors) {
        const matches = document.querySelectorAll(selector);
        matches.forEach(el => elements.push(el as HTMLElement));
      }
      
      if (elements.length > 0) {
        // Calculate combined bounding box of all elements
        const rects = elements.map(el => el.getBoundingClientRect());
        const minTop = Math.min(...rects.map(r => r.top));
        const minLeft = Math.min(...rects.map(r => r.left));
        const maxRight = Math.max(...rects.map(r => r.right));
        const maxBottom = Math.max(...rects.map(r => r.bottom));
        
        const combinedRect = {
          top: minTop,
          left: minLeft,
          right: maxRight,
          bottom: maxBottom,
          width: maxRight - minLeft,
          height: maxBottom - minTop
        };
        
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        const padding = step.customPadding || {
          top: step.highlightPadding || 10,
          right: step.highlightPadding || 10,
          bottom: step.highlightPadding || 10,
          left: step.highlightPadding || 10
        };

        setPosition({
          top: combinedRect.top + scrollY - padding.top,
          left: combinedRect.left + scrollX - padding.left,
          width: combinedRect.width + padding.left + padding.right,
          height: combinedRect.height + padding.top + padding.bottom
        });

        if (overlayRef.current) {
          overlayRef.current.style.setProperty('--target-top', `${combinedRect.top + scrollY - padding.top}px`);
          overlayRef.current.style.setProperty('--target-left', `${combinedRect.left + scrollX - padding.left}px`);
          overlayRef.current.style.setProperty('--target-width', `${combinedRect.width + padding.left + padding.right}px`);
          overlayRef.current.style.setProperty('--target-height', `${combinedRect.height + padding.top + padding.bottom}px`);
        }

        // Position tooltip and scroll handling (same as below)
        let finalPosition = step.position || 'bottom';
        
        if (!isMobile()) {
          const viewportHeight = window.innerHeight;
          const tooltipHeight = 320;
          const margin = 20;
          
          const spaceBelow = viewportHeight - combinedRect.bottom;
          const spaceAbove = combinedRect.top;
          
          if (finalPosition === 'top' && spaceAbove < tooltipHeight + margin) {
            finalPosition = 'bottom';
          } 
          else if (finalPosition === 'bottom' && spaceBelow < tooltipHeight + margin) {
            if (spaceAbove > tooltipHeight + margin) {
              finalPosition = 'top';
            }
          }
        }
        
        setTooltipPosition(finalPosition);
        
        if (isMobile()) {
          elements[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          if (finalPosition === 'top') {
            window.scrollTo({
              top: combinedRect.top + window.scrollY - window.innerHeight * 0.6,
              behavior: 'smooth'
            });
          } else {
            window.scrollTo({
              top: combinedRect.top + window.scrollY - window.innerHeight * 0.2,
              behavior: 'smooth'
            });
          }
        }
        return; // Exit early after handling combined target
      }
    }
    
    // ORIGINAL: Single element targeting
    let element: HTMLElement | null = null;
    for (const selector of selectors) {
      element = document.querySelector(selector) as HTMLElement;
      if (element) break;
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Support custom padding (asymmetric) or fallback to symmetric
      const padding = step.customPadding || {
        top: step.highlightPadding || 10,
        right: step.highlightPadding || 10,
        bottom: step.highlightPadding || 10,
        left: step.highlightPadding || 10
      };

      setPosition({
        top: rect.top + scrollY - padding.top,
        left: rect.left + scrollX - padding.left,
        width: rect.width + padding.left + padding.right,
        height: rect.height + padding.top + padding.bottom
      });

      if (overlayRef.current) {
        overlayRef.current.style.setProperty('--target-top', `${rect.top + scrollY - padding.top}px`);
        overlayRef.current.style.setProperty('--target-left', `${rect.left + scrollX - padding.left}px`);
        overlayRef.current.style.setProperty('--target-width', `${rect.width + padding.left + padding.right}px`);
        overlayRef.current.style.setProperty('--target-height', `${rect.height + padding.top + padding.bottom}px`);
      }

      let finalPosition = step.position || 'bottom';
      
      if (!isMobile()) {
        const viewportHeight = window.innerHeight;
        const tooltipHeight = 320;
        const margin = 20;
        
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (finalPosition === 'top' && spaceAbove < tooltipHeight + margin) {
          finalPosition = 'bottom';
        } 
        else if (finalPosition === 'bottom' && spaceBelow < tooltipHeight + margin) {
          if (spaceAbove > tooltipHeight + margin) {
            finalPosition = 'top';
          }
        }
      }
      
      setTooltipPosition(finalPosition);
      
      if (isMobile()) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        if (finalPosition === 'top') {
          window.scrollTo({
            top: rect.top + window.scrollY - window.innerHeight * 0.6,
            behavior: 'smooth'
          });
        } else {
          window.scrollTo({
            top: rect.top + window.scrollY - window.innerHeight * 0.2,
            behavior: 'smooth'
          });
        }
      }
    } else {
      // FALLBACK: Element not found - position tooltip in center of screen
      console.warn(`Tutorial step ${step.id}: Element not found for selector "${step.target}"`);
      
      const fallbackPosition = {
        top: window.scrollY + (window.innerHeight / 2) - 200,
        left: (window.innerWidth / 2) - 200,
        width: 400,
        height: 100
      };
      
      setPosition(fallbackPosition);
      setTooltipPosition('bottom');
      
      if (overlayRef.current) {
        overlayRef.current.style.setProperty('--target-top', `${fallbackPosition.top}px`);
        overlayRef.current.style.setProperty('--target-left', `${fallbackPosition.left}px`);
        overlayRef.current.style.setProperty('--target-width', `${fallbackPosition.width}px`);
        overlayRef.current.style.setProperty('--target-height', `${fallbackPosition.height}px`);
      }
    }
  };

  const handleBackdropClick = () => {
    handleSkip();
  };

  const handleNext = () => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };
  
  const handleLearnMore = () => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };
  
  const handleSkipSubsteps = () => {
    const currentId = TUTORIAL_STEPS[currentStepIndex].id;
    const mainStepNum = parseInt(currentId.split('.')[0]);
    
    const nextMainStepIndex = TUTORIAL_STEPS.findIndex((step, idx) => {
      if (idx <= currentStepIndex) return false;
      const stepNum = parseInt(step.id.split('.')[0]);
      return stepNum > mainStepNum && !step.id.includes('.');
    });
    
    if (nextMainStepIndex !== -1) {
      setCurrentStepIndex(nextMainStepIndex);
    } else {
      completeTutorial();
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    localStorage.setItem('tutorial-completed', 'true');
    setIsActive(false);
    window.dispatchEvent(new Event('tutorial-completed'));
    if (onComplete) onComplete();
  };

  if (!isActive) return null;

  const step = TUTORIAL_STEPS[currentStepIndex];
  
  const mainSteps = TUTORIAL_STEPS.filter(s => !s.id.includes('.'));
  const currentMainStepId = step.id.split('.')[0];
  const currentMainStepNum = mainSteps.findIndex(s => s.id === currentMainStepId) + 1;
  const progress = (currentMainStepNum / mainSteps.length) * 100;
  
  const isSubstep = step.id.includes('.');

  return (
    <div className="tutorial-overlay" ref={overlayRef}>
      <div className="tutorial-backdrop tutorial-backdrop-soft" />
      
      <div onClick={handleBackdropClick} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(0, position.top), pointerEvents: 'all', zIndex: 9998 }} />
      <div onClick={handleBackdropClick} style={{ position: 'absolute', top: position.top + position.height, left: 0, right: 0, bottom: 0, pointerEvents: 'all', zIndex: 9998 }} />
      <div onClick={handleBackdropClick} style={{ position: 'absolute', top: position.top, left: 0, width: Math.max(0, position.left), height: position.height, pointerEvents: 'all', zIndex: 9998 }} />
      <div onClick={handleBackdropClick} style={{ position: 'absolute', top: position.top, left: position.left + position.width, right: 0, height: position.height, pointerEvents: 'all', zIndex: 9998 }} />
      
      <div style={{ position: 'absolute', top: position.top, left: position.left, width: position.width, height: position.height, pointerEvents: 'none', zIndex: 10000 }} />
      
      <div className="tutorial-highlight" style={{ top: position.top, left: position.left, width: position.width, height: position.height, pointerEvents: 'none', zIndex: 10001 }} />

      <div 
        className={`tutorial-tooltip tooltip-${tooltipPosition}`}
        style={{
          top: tooltipPosition === 'bottom' ? position.top + position.height : tooltipPosition === 'top' ? Math.max(370, position.top) : position.top + (position.height / 2),
          left: position.left + (position.width / 2),
        }}
      >
        <div className="tooltip-header">
          <div className="tooltip-title-row">
            <h3 className="tooltip-title">{step.title}</h3>
            {isSubstep && <span className="substep-badge">Detail</span>}
          </div>
          {/* FIX #2: Removed redundant close button (X) - only keep Skip Tutorial */}
        </div>

        <div className="tooltip-description">{step.description}</div>

        {step.points && step.points.length > 0 && (
          <ul className="tooltip-points">
            {step.points.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        )}

        {step.action && (
          <div className="tooltip-action">
            <div className="action-hint">💡 {step.action.hint}</div>
          </div>
        )}

        <div className="tooltip-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* FIX #1: Repositioned navigation with skip button on far left */}
        <div className="tooltip-nav">
          {/* FIX #3: Skip button ALWAYS shown on main steps, allowing users to skip details */}
          {!isSubstep && step.hasSubsteps && (
            <button className="nav-btn nav-skip-tutorial" onClick={handleSkip}>
              Skip Tutorial
            </button>
          )}
          {isSubstep && (
            <button className="nav-btn nav-skip-substeps" onClick={handleSkipSubsteps}>
              Skip Details
            </button>
          )}
          {!step.hasSubsteps && !isSubstep && (
            <button className="nav-btn nav-skip-tutorial" onClick={handleSkip}>
              Skip Tutorial
            </button>
          )}

          <div className="nav-controls">
            <button className="nav-btn nav-prev" onClick={handlePrev} disabled={currentStepIndex === 0}>
              ← Back
            </button>

            <span className="step-counter">
              {currentMainStepNum} / {mainSteps.length}
            </span>

            {/* Show different buttons based on context */}
            {step.hasSubsteps && !isSubstep ? (
              // Main step with substeps - show "Learn More"
              <button className="nav-btn nav-learn-more" onClick={handleLearnMore}>
                💡 Learn More
              </button>
            ) : (
              // Default - show "Next" or "Finish"
              <button className="nav-btn nav-next" onClick={handleNext}>
                {currentStepIndex === TUTORIAL_STEPS.length - 1 ? '✓ Finish' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}