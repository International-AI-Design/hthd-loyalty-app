import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { waitForScrollAndLayout, isRectInViewport } from '../lib/waitUntil';

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

export function Walkthrough({ steps, onComplete, onSkip }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const step = steps[currentStep];

  const resolveTarget = () => document.getElementById(step.targetId);

  // Continuous measurement loop - keeps spotlight aligned while user scrolls
  useEffect(() => {
    if (!ready) return;

    const measure = () => {
      const el = resolveTarget();
      const rect = el?.getBoundingClientRect() ?? null;
      setTargetRect(rect);
      rafRef.current = requestAnimationFrame(measure);
    };

    rafRef.current = requestAnimationFrame(measure);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ready, step.targetId]);

  // On step change: scroll first, then show (ready=true)
  useLayoutEffect(() => {
    let cancelled = false;

    async function go() {
      setReady(false);
      setTargetRect(null);

      const el = resolveTarget();
      if (!el) return;

      // Scroll element into view first (center works best for mobile)
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

      // Wait for scroll and layout to stabilize
      await waitForScrollAndLayout({
        getRect: () => resolveTarget()?.getBoundingClientRect() ?? null,
      });

      if (cancelled) return;

      const rect = el.getBoundingClientRect();
      // If still not visible, force it without smooth scroll
      if (!isRectInViewport(rect, 12)) {
        el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        await waitForScrollAndLayout({
          getRect: () => resolveTarget()?.getBoundingClientRect() ?? null,
        });
      }

      if (cancelled) return;
      setTargetRect(resolveTarget()?.getBoundingClientRect() ?? null);
      setReady(true);
    }

    go();
    return () => {
      cancelled = true;
    };
  }, [currentStep, step.targetId]);

  // Tooltip positioning
  const tooltipStyle = useMemo(() => {
    if (!targetRect) return { opacity: 0, pointerEvents: 'none' as const };

    const margin = 16;
    const width = Math.min(300, window.innerWidth - margin * 2);
    const estimatedHeight = 180;

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
      // If still off screen, just go below anyway
      if (top < 20) {
        top = belowTop;
        arrowOnTop = true;
      }
    }

    const idealLeft = targetRect.left + targetRect.width / 2 - width / 2;
    const left = clamp(idealLeft, margin, window.innerWidth - margin - width);

    // Calculate arrow offset from center based on clamping
    const arrowOffset = targetRect.left + targetRect.width / 2 - left - width / 2;

    return {
      position: 'fixed' as const,
      top,
      left,
      width,
      zIndex: 10002,
      pointerEvents: 'auto' as const,
      opacity: ready ? 1 : 0,
      transform: ready ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      arrowOnTop,
      arrowOffset: clamp(arrowOffset, -width / 2 + 24, width / 2 - 24),
    };
  }, [targetRect, ready]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  if (!targetRect && !ready) {
    // Show loading state briefly
    return null;
  }

  return createPortal(
    <div aria-live="polite">
      {/* Spotlight overlay - pointer-events: none allows touch scrolling */}
      {ready && targetRect && (
        <SpotlightOverlay rect={targetRect} padding={10} radius={16} />
      )}

      {/* Tooltip - in portal, above overlay, pointer-events: auto */}
      <div style={tooltipStyle}>
        {/* Arrow */}
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

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 relative">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-brand-teal">
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
            className="w-full py-3 px-4 bg-brand-teal text-white font-medium rounded-xl hover:bg-brand-teal-dark transition-colors min-h-[48px] text-base"
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

  // Unique mask id to avoid collisions
  const maskIdRef = useRef(`walkthrough-mask-${Math.random().toString(36).slice(2)}`);

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10001,
        pointerEvents: 'none', // Critical: allows touch scrolling
      }}
    >
      <defs>
        <mask id={maskIdRef.current}>
          {/* White = visible overlay; black = cut out (spotlight hole) */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={radius} ry={radius} fill="black" />
        </mask>
      </defs>

      {/* Dark overlay with spotlight hole */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask={`url(#${maskIdRef.current})`}
      />

      {/* Highlight ring around the target */}
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
