import { useState, useEffect, useCallback } from 'react';

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

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

export function Walkthrough({ steps, onComplete, onSkip }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const calculatePosition = useCallback(() => {
    const step = steps[currentStep];
    const targetEl = document.getElementById(step.targetId);

    if (!targetEl) {
      return null;
    }

    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 150;
    const padding = 16;
    const arrowSize = 12;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default: position below the element
    let top = rect.bottom + arrowSize + padding;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

    // If tooltip would go off right edge, align to right
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    // If tooltip would go off left edge, align to left
    if (left < padding) {
      left = padding;
    }

    // If tooltip would go off bottom, position above
    if (top + tooltipHeight > viewportHeight - padding) {
      top = rect.top - tooltipHeight - arrowSize - padding;
      arrowPosition = 'bottom';
    }

    // Scroll element into view if needed
    if (rect.top < 0 || rect.bottom > viewportHeight) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return { top, left, arrowPosition };
  }, [currentStep, steps]);

  useEffect(() => {
    const pos = calculatePosition();
    setPosition(pos);

    const handleResize = () => {
      const newPos = calculatePosition();
      setPosition(newPos);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [calculatePosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 150);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];
  const targetEl = document.getElementById(step.targetId);

  if (!position || !targetEl) {
    return null;
  }

  const targetRect = targetEl.getBoundingClientRect();

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40">
        {/* Dark overlay with cutout */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="walkthrough-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#walkthrough-mask)"
          />
        </svg>

        {/* Highlight ring around target */}
        <div
          className="absolute border-2 border-brand-teal rounded-xl pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 4px rgba(45, 183, 166, 0.3)',
          }}
        />
      </div>

      {/* Tooltip */}
      <div
        className={`fixed z-50 w-[280px] bg-white rounded-xl shadow-2xl transition-opacity duration-150 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-4 h-4 bg-white transform rotate-45 ${
            position.arrowPosition === 'top'
              ? '-top-2 left-1/2 -translate-x-1/2'
              : '-bottom-2 left-1/2 -translate-x-1/2'
          }`}
          style={{
            boxShadow:
              position.arrowPosition === 'top'
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
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip tour
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
