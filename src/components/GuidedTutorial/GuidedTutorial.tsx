import { useState, useEffect, useRef } from 'react';
import './GuidedTutorial.css';

// Detect mobile
const isMobile = () => window.innerWidth <= 600;

interface TutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  fallbackTitle?: string; // NEW: Title to show when target not found
  fallbackDescription?: string; // NEW: Description when target not found
  points?: string[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding?: number;
  customPadding?: { top: number; right: number; bottom: number; left: number };
  combinedTarget?: boolean;
  smartPosition?: boolean;
  action?: {
    hint: string;
    check?: () => boolean;
  };
  switchToTab?: string;
  controlsTab?: 'melody' | 'rhythm' | 'mixer' | 'more'; // NEW: Which controls tab to open
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
    description: 
    'This is a Call and Response ear training designed to help you internalize scale degrees.',
    
    points: [
      'Three practice modes to choose from. Each mode has a different learning approach.',
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
    description: 'Structured curriculum with progressive levels. Each level introduces ONE new scale degree. Spend 10 minutes in a level to unlock the next one.',
    points: [
      'Four stages per level, increasing in difficulty',
      'Perfect for systematic ear training development'
    ],
    position: 'bottom',
    highlightPadding: 8
  },
  {
    id: '1.3',
    target: '.tabs button:nth-child(3)',
    title: '🎸 Fretboard Mode',
    description: 'Guitar-specific practice using CAGED system. Practice scale shapes across the fretboard. Switch between shapes (C, A, G, E, D).',
    points: [
      'Visual fretboard shows note positions as melodies play',
      'Inverse mode enabled by default: Listen first, then play along and see answer',
      'Quick tip: Use Blind Mode (in the controls) to hide visuals during listen phase for extra challenge!'
    ],
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
      '🎯 Try it: Click on a degree to exclude/include it',
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
  
  // STEP 5: Controls (with substeps)
  {
    id: '5',
    target: '.settings-trigger, .controls-accordion',
    title: '⚙️ Customize Everything',
    description: 'Click here to open the control settings. Four tabs with different options.',
    points: [
      '💡 Hover over any button for helpful tooltips!'
    ],
    position: 'top',
    highlightPadding: 15,
    combinedTarget: true,
    switchToTab: 'random',
    openControls: true,
    controlsTab: 'melody',
    waitForLayout: true,
    hasSubsteps: true
  },
  {
    id: '5.1',
    target: '.control-tabs, .controls-content',
    title: '🎼 Melody Controls',
    description: 'Difficulty (easiest to hard), tempo, root note constraints, and vocal range calibration. Control how melodies are generated.',
    position: 'top',
    highlightPadding: 15,
    combinedTarget: true,
    openControls: true,
    controlsTab: 'melody'
  },
  {
    id: '5.2',
    target: '.control-tabs, .controls-content',
    title: '🥁 Rhythm Controls',
    description: 'Choose from 9 drum patterns across 3 styles: Classic, Lofi Chill, Bossa Vibe, and Percussion Only. Find a groove that works for you.',
    position: 'top',
    highlightPadding: 15,
    combinedTarget: true,
    openControls: true,
    controlsTab: 'rhythm'
  },
  {
    id: '5.3',
    target: '.control-tabs, .controls-content',
    title: '🎚️ Mixer Controls',
    description: 'Adjust volume for vocals, drums, drone, metronome, training synth, and master output. Add reverb for space. Create your perfect mix.',
    position: 'top',
    highlightPadding: 15,
    combinedTarget: true,
    openControls: true,
    controlsTab: 'mixer'
  },
  {
    id: '5.4',
    target: '.control-tabs, .controls-content',
    title: '🔧 Advanced Modes',
    description: 'Pitch Guide, Inverse Mode (hear then sing), Blind Mode (hide visuals during listen). Experiment with these!',
    position: 'top',
    highlightPadding: 15,
    combinedTarget: true,
    openControls: true,
    controlsTab: 'more'
  },
  // NEW: Step 5.5 - Pro Tip for Inverse + Blind Mode  
  {
    id: '5.5',
    target: '.control-tabs, .controls-content',
    title: '💡 Pro Tip: Test Yourself!',
    description: 'In the Melody tab, you will find Inverse Mode and Blind Mode buttons. Use them together to challenge yourself: You will hear the melody played twice by synth, then on the third time the scale degrees appear. Try to identify them before they are shown!',
    fallbackTitle: '⚠️ Please Open Controls First',
    combinedTarget: true,
    fallbackDescription: 'To see this pro tip, please open the Controls panel. The buttons are in the Melody tab. Then click "Next" to continue the tutorial.',
    position: 'top',
    highlightPadding: 15,
    openControls: true,
    controlsTab: 'melody'
  }
];

interface GuidedTutorialProps {
  onComplete?: () => void;
  onTabChange?: (tab: string) => void;
  onControlsOpen?: (shouldOpen: boolean) => void; // NEW: Signal to open/close controls
  onControlsTabChange?: (tab: 'melody' | 'rhythm' | 'mixer' | 'more') => void; // NEW: Signal which tab
}

export default function GuidedTutorial({ onComplete, onTabChange, onControlsOpen, onControlsTabChange }: GuidedTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [showFallback, setShowFallback] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const controlsOpenedRef = useRef(false); // NEW: Track if we've already opened controls

  useEffect(() => {
    const completed = localStorage.getItem('tutorial-completed');
    if (!completed) {
      setTimeout(() => setIsActive(true), 1000);
    }
  }, []);

  // FIX: Set tutorial mode flag AND lock scroll to prevent layout issues
  // EXCEPT during controls steps where we need to scroll to see everything
  useEffect(() => {
    if (isActive) {
      document.body.dataset.tutorialActive = 'true';
      
      // Check if current step is a controls step (5.x)
      const step = TUTORIAL_STEPS[currentStepIndex];
      const isControlsStep = step && step.id.startsWith('5.') && step.id !== '5';
      
      if (isControlsStep) {
        // Allow scrolling for controls steps since they're tall
        document.body.style.overflow = '';
      } else {
        // Lock body scroll for other steps
        document.body.style.overflow = 'hidden';
      }
    } else {
      delete document.body.dataset.tutorialActive;
      // Restore body scroll
      document.body.style.overflow = '';
    }
    
    return () => {
      delete document.body.dataset.tutorialActive;
      document.body.style.overflow = '';
    };
  }, [isActive, currentStepIndex]);

  useEffect(() => {
    if (!isActive) return;

    const step = TUTORIAL_STEPS[currentStepIndex];
    
    // Handle controls panel opening (only once!)
    if (step.openControls && !controlsOpenedRef.current) {
      if (onControlsOpen) {
        // Use callback if provided
        onControlsOpen(true);
        controlsOpenedRef.current = true;
      } else {
        // Fallback: Programmatically click the controls button
        const controlsButton = document.querySelector('.settings-trigger') as HTMLElement;
        if (controlsButton) {
          // Check if controls are already open by looking for expanded class or visibility
          const controlsPanel = document.querySelector('.controls-panel');
          const isOpen = controlsPanel && controlsPanel.clientHeight > 0;
          
          if (!isOpen) {
            controlsButton.click();
            controlsOpenedRef.current = true; // Mark as opened
          }
        }
      }
    }
    
    // Handle controls tab switching
    if (step.controlsTab && onControlsTabChange) {
      onControlsTabChange(step.controlsTab);
    } else if (step.controlsTab) {
      // Fallback: Programmatically click the tab button
      setTimeout(() => {
        const tabSelectors = {
          melody: 'button[aria-label*="Melody"], button:has(svg):nth-child(1)',
          rhythm: 'button[aria-label*="Rhythm"], button:has(svg):nth-child(2)',
          mixer: 'button[aria-label*="Mixer"], button:has(svg):nth-child(3)',
          more: 'button[aria-label*="More"], button:has(svg):nth-child(4)'
        };
        
        const selector = tabSelectors[step.controlsTab!];
        const tabButton = document.querySelector(selector) as HTMLElement;
        if (tabButton) {
          tabButton.click();
        }
      }, 100);
    }
    
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
      // Also wait for layout if controls need to open
      if (step.openControls || step.controlsTab) {
        // Controls have animation - need multiple retries with longer delays
        setTimeout(() => updateHighlight(), 300); // Increased from 200
        const checks = [400, 500, 600, 700, 800, 900, 1000]; // More retries, longer delays
        checks.forEach(delay => {
          setTimeout(() => updateHighlight(), delay);
        });
      } else {
        updateHighlight();
      }
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
        setShowFallback(false); // Reset fallback state when elements found
        
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

        // Position tooltip and scroll handling
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
        
        // IMPROVED: Better scrolling that ensures element is visible
        if (isMobile()) {
          elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Check if element is in viewport
          const isInViewport = combinedRect.top >= 0 && 
                               combinedRect.bottom <= window.innerHeight &&
                               combinedRect.left >= 0 && 
                               combinedRect.right <= window.innerWidth;
          
          if (!isInViewport) {
            // Position element in upper-third of viewport (not dead center)
            // This prevents scrolling too far down
            const targetPosition = finalPosition === 'top' 
              ? combinedRect.top + window.scrollY - (window.innerHeight * 0.6) // If tooltip below, show more space above
              : combinedRect.top + window.scrollY - (window.innerHeight * 0.25); // If tooltip above, show element near top
            
            window.scrollTo({
              top: Math.max(0, targetPosition), // Don't scroll above page top
              behavior: 'smooth'
            });
          }
        }
        return; // Exit early after handling combined target
      } else {
        // FALLBACK: Elements not found (e.g., controls not open)
        console.warn(`Tutorial step ${step.id}: No elements found for combined target "${step.target}"`);
        
        // Check if this is step 5.5 and suggest opening controls
        if (step.id === '5.5' && step.openControls) {
          setShowFallback(true); // NEW: Signal to show fallback text
          
          // Show fallback tooltip prompting user to open controls
          const fallbackPosition = {
            top: window.scrollY + (window.innerHeight / 2) - 100,
            left: (window.innerWidth / 2) - 200,
            width: 400,
            height: 80
          };
          
          setPosition(fallbackPosition);
          setTooltipPosition('bottom');
          
          if (overlayRef.current) {
            overlayRef.current.style.setProperty('--target-top', `${fallbackPosition.top}px`);
            overlayRef.current.style.setProperty('--target-left', `${fallbackPosition.left}px`);
            overlayRef.current.style.setProperty('--target-width', `${fallbackPosition.width}px`);
            overlayRef.current.style.setProperty('--target-height', `${fallbackPosition.height}px`);
          }
          return;
        }
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
      
      // Check if element is in viewport, scroll if not (especially for controls panel)
      const isInViewport = rect.top >= 0 && 
                           rect.bottom <= window.innerHeight &&
                           rect.left >= 0 && 
                           rect.right <= window.innerWidth;
      
      if (isMobile()) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!isInViewport || step.controlsTab) {
        // Always scroll for controls tabs OR if element is out of viewport
        const targetPosition = finalPosition === 'top' 
          ? rect.top + window.scrollY - (window.innerHeight * 0.6)
          : rect.top + window.scrollY - (window.innerHeight * 0.25);
        
        window.scrollTo({
          top: Math.max(0, targetPosition),
          behavior: 'smooth'
        });
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
    setShowFallback(false); // Reset fallback when moving to next step
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrev = () => {
    setShowFallback(false); // Reset fallback when going back
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
            <h3 className="tooltip-title">
              {showFallback && step.fallbackTitle ? step.fallbackTitle : step.title}
            </h3>
            {isSubstep && <span className="substep-badge">Detail</span>}
          </div>
          {/* FIX #2: Removed redundant close button (X) - only keep Skip Tutorial */}
        </div>

        <div className="tooltip-description">
          {showFallback && step.fallbackDescription ? step.fallbackDescription : step.description}
        </div>

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
            <button className="nav-btn nav-skip-tutorial" onClick={(e) => { e.stopPropagation(); handleSkip(); }}>
              Skip Tutorial
            </button>
          )}
          {isSubstep && (
            <button className="nav-btn nav-skip-substeps" onClick={(e) => { e.stopPropagation(); handleSkipSubsteps(); }}>
              Skip Details
            </button>
          )}
          {!step.hasSubsteps && !isSubstep && (
            <button className="nav-btn nav-skip-tutorial" onClick={(e) => { e.stopPropagation(); handleSkip(); }}>
              Skip Tutorial
            </button>
          )}

          <div className="nav-controls">
            <button className="nav-btn nav-prev" onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={currentStepIndex === 0}>
              ← Back
            </button>

            <span className="step-counter">
              {currentMainStepNum} / {mainSteps.length}
            </span>

            {/* Show different buttons based on context */}
            {step.hasSubsteps && !isSubstep ? (
              // Main step with substeps - show "Learn More"
              <button className="nav-btn nav-learn-more" onClick={(e) => { e.stopPropagation(); handleLearnMore(); }}>
                💡 Learn More
              </button>
            ) : (
              // Default - show "Next" or "Finish"
              <button className="nav-btn nav-next" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                {currentStepIndex === TUTORIAL_STEPS.length - 1 ? '✓ Finish' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}