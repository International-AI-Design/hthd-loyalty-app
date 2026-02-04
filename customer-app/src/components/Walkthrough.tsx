import { useState, useEffect, useRef } from 'react';

interface WalkthroughStep {
  targetId: string;
  title: string;
  message: string;
}

interface WalkthroughProps {
  steps: WalkthroughStep[];
  onComplete: () => void;
  onSkip: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Walkthrough({ steps, onComplete, onSkip }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  // Scroll to element and update position
  useEffect(() => {
    const targetEl = document.getElementById(step.targetId);
    if (!targetEl) return;

    // First scroll the element into view with some padding
    const scrollToElement = () => {
      const rect = targetEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if element is not fully visible
      if (rect.top < 100 || rect.bottom > viewportHeight - 200) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // Initial scroll
    scrollToElement();

    // Wait for scroll to complete, then show and position
    const showTimeout = setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setIsVisible(true);
    }, 400);

    return () => clearTimeout(showTimeout);
  }, [step.targetId]);

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { opacity: 0 };

    const tooltipWidth = 280;
    const tooltipHeight = 180;
    const gap = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Try to position below first
    let top = targetRect.top + targetRect.height + gap;
    let arrowTop = true;

    // If not enough room below, position above
    if (top + tooltipHeight > viewportHeight - 20) {
      top = targetRect.top - tooltipHeight - gap;
      arrowTop = false;
    }

    // If still off screen (element near top), just position below
    if (top < 20) {
      top = targetRect.top + targetRect.height + gap;
      arrowTop = true;
    }

    // Horizontal centering with bounds checking
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16));

    return {
      position: 'fixed' as const,
      top,
      left,
      width: tooltipWidth,
      zIndex: 51,
      '--arrow-top': arrowTop ? '-8px' : 'auto',
      '--arrow-bottom': arrowTop ? 'auto' : '-8px',
    } as React.CSSProperties;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 200);
    } else {
      onComplete();
    }
  };

  if (!targetRect) {
    return null;
  }

  const tooltipStyle = getTooltipStyle();
  const arrowOnTop = tooltipStyle['--arrow-top'] === '-8px';

  return (
    <>
      {/* Semi-transparent overlay - allows scrolling through */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      />

      {/* Spotlight cutout */}
      <div
        className="fixed z-40 pointer-events-none rounded-xl"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(45, 183, 166, 0.5)',
          transition: 'all 0.3s ease-out',
        }}
      />

      {/* Pulsing ring */}
      <div
        className="fixed z-40 pointer-events-none rounded-xl border-2 border-brand-teal animate-pulse"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          transition: 'all 0.3s ease-out',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-50 bg-white rounded-xl shadow-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45"
          style={{
            top: arrowOnTop ? '-8px' : 'auto',
            bottom: arrowOnTop ? 'auto' : '-8px',
            boxShadow: arrowOnTop
              ? '-2px -2px 4px rgba(0,0,0,0.05)'
              : '2px 2px 4px rgba(0,0,0,0.05)',
          }}
        />

        {/* Content */}
        <div className="p-4 relative">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-teal">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2"
            >
              Skip
            </button>
          </div>

          {/* Title and message */}
          <h3 className="text-base font-semibold text-brand-navy mb-1">
            {step.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">{step.message}</p>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full py-2.5 px-4 bg-brand-teal text-white font-medium rounded-lg hover:bg-brand-teal-dark transition-colors min-h-[44px]"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
