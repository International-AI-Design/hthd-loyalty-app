import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Wait for element to be in stable position (rect unchanged for N frames)
function waitForStablePosition(
  el: HTMLElement,
  frameCount: number = 10
): Promise<DOMRect> {
  return new Promise((resolve) => {
    let lastRect = el.getBoundingClientRect();
    let stableFrames = 0;

    const check = () => {
      const rect = el.getBoundingClientRect();
      const same =
        Math.abs(rect.top - lastRect.top) < 1 &&
        Math.abs(rect.left - lastRect.left) < 1;

      if (same) {
        stableFrames++;
        if (stableFrames >= frameCount) {
          resolve(rect);
          return;
        }
      } else {
        stableFrames = 0;
        lastRect = rect;
      }
      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  });
}

export function Walkthrough({ steps, onComplete, onSkip }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const rafRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const step = steps[currentStep];

  // Scroll to element and measure its position
  const scrollAndMeasure = useCallback(async (targetId: string) => {
    setIsReady(false);
    setTargetRect(null);

    // Retry finding element up to 10 times over 1 second
    let el: HTMLElement | null = null;
    for (let i = 0; i < 10; i++) {
      el = document.getElementById(targetId);
      if (el) break;
      await new Promise((r) => setTimeout(r, 100));
      if (!isMountedRef.current) return;
    }

    if (!el || !isMountedRef.current) {
      console.warn(`Walkthrough: element #${targetId} not found`);
      return;
    }

    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait for position to stabilize (handles variable scroll durations)
    const rect = await waitForStablePosition(el, 8);

    if (!isMountedRef.current) return;

    // Set state and show
    setTargetRect(rect);
    setIsReady(true);
  }, []);

  // Run scroll/measure on step change
  useEffect(() => {
    isMountedRef.current = true;
    scrollAndMeasure(step.targetId);

    return () => {
      isMountedRef.current = false;
    };
  }, [step.targetId, scrollAndMeasure]);

  // Keep spotlight aligned while visible (but don't track during transitions)
  useEffect(() => {
    if (!isReady) return;

    const measure = () => {
      const el = document.getElementById(step.targetId);
      if (el && isMountedRef.current) {
        setTargetRect(el.getBoundingClientRect());
      }
      rafRef.current = requestAnimationFrame(measure);
    };

    rafRef.current = requestAnimationFrame(measure);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isReady, step.targetId]);

  // Tooltip positioning
  const tooltipStyle = useMemo(() => {
    if (!targetRect) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: Math.min(300, window.innerWidth - 32),
        zIndex: 10002,
        pointerEvents: 'auto' as const,
        opacity: 0,
      };
    }

    const margin = 16;
    const width = Math.min(300, window.innerWidth - margin * 2);
    const estimatedHeight = 200;

    // Prefer below target; if not enough room, place above
    const belowTop = targetRect.bottom + 16;
    const fitsBelow = belowTop + estimatedHeight < window.innerHeight - 20;

    let top: number;
    let arrowOnTop = true;

    if (fitsBelow) {
      top = belowTop;
    } else {
      top = targetRect.top - estimatedHeight - 16;
      arrowOnTop = false;
      if (top < 20) {
        top = belowTop;
        arrowOnTop = true;
      }
    }

    const idealLeft = targetRect.left + targetRect.width / 2 - width / 2;
    const left = clamp(idealLeft, margin, window.innerWidth - margin - width);
    const arrowOffset = targetRect.left + targetRect.width / 2 - left - width / 2;

    return {
      position: 'fixed' as const,
      top,
      left,
      width,
      zIndex: 10002,
      pointerEvents: 'auto' as const,
      opacity: isReady ? 1 : 0,
      transition: 'opacity 0.3s ease',
      arrowOnTop,
      arrowOffset: clamp(arrowOffset, -width / 2 + 24, width / 2 - 24),
    };
  }, [targetRect, isReady]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  return createPortal(
    <div aria-live="polite">
      {/* Spotlight overlay */}
      {isReady && targetRect && (
        <SpotlightOverlay rect={targetRect} padding={10} radius={16} />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {/* Arrow */}
        {targetRect && (
          <div
            className="absolute w-4 h-4 bg-white rotate-45"
            style={{
              left: `calc(50% + ${tooltipStyle.arrowOffset || 0}px)`,
              transform: 'translateX(-50%) rotate(45deg)',
              top: tooltipStyle.arrowOnTop ? '-8px' : 'auto',
              bottom: tooltipStyle.arrowOnTop ? 'auto' : '-8px',
              boxShadow: tooltipStyle.arrowOnTop
                ? '-2px -2px 4px rgba(0,0,0,0.05)'
                : '2px 2px 4px rgba(0,0,0,0.05)',
            }}
          />
        )}

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 relative">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-brand-blue">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={onSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2"
            >
              Skip
            </button>
          </div>

          {/* Title and message */}
          <h3 className="text-lg font-semibold text-brand-navy mb-2 font-heading">
            {step.title}
          </h3>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">{step.message}</p>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full py-3 px-4 bg-brand-blue text-white font-medium rounded-xl hover:bg-brand-blue-dark transition-colors min-h-[48px] text-base"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SpotlightOverlay({
  rect,
  padding,
  radius,
}: {
  rect: DOMRect;
  padding: number;
  radius: number;
}) {
  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;

  const maskId = useRef(`walkthrough-mask-${Math.random().toString(36).slice(2)}`);

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10001,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <mask id={maskId.current}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={radius} ry={radius} fill="black" />
        </mask>
      </defs>

      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask={`url(#${maskId.current})`}
      />

      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        ry={radius}
        fill="none"
        stroke="rgba(45, 183, 166, 0.6)"
        strokeWidth="3"
      />
    </svg>
  );
}
