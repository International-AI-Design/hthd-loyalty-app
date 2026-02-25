import { useEffect, useCallback } from 'react';
import { badgeApi } from '../lib/api';
import type { CustomerBadge } from '../lib/api';

interface BadgeUnlockAnimationProps {
  badges: CustomerBadge[];
  onDismiss: () => void;
}

export function BadgeUnlockAnimation({ badges, onDismiss }: BadgeUnlockAnimationProps) {
  const badge = badges[0];
  if (!badge) return null;

  const handleDismiss = useCallback(async () => {
    for (const b of badges) {
      if (!b.notified) {
        await badgeApi.markNotified(b.id);
      }
    }
    onDismiss();
  }, [badges, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 8000);
    return () => clearTimeout(timer);
  }, [handleDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="badge-unlock-container relative mx-4 max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CSS confetti dots */}
        <div className="confetti-wrapper absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="confetti-dot absolute rounded-full"
              style={{
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                left: `${10 + Math.random() * 80}%`,
                top: `${-10}%`,
                backgroundColor: ['#62A2C3', '#F5C65D', '#7FB685', '#E8837B', '#1B365D'][i % 5],
                animationDelay: `${i * 0.15}s`,
                animationDuration: `${1.5 + Math.random()}s`,
              }}
            />
          ))}
        </div>

        {/* Badge icon */}
        <div className="badge-icon-pop text-6xl mb-4">{badge.icon}</div>

        {/* Badge earned text */}
        <p className="text-xs uppercase tracking-widest text-brand-primary font-semibold mb-1">
          Badge Earned!
        </p>
        <h2 className="font-heading text-2xl font-bold text-brand-forest mb-2">
          {badge.displayName}
        </h2>
        <p className="text-sm text-gray-500 mb-6">{badge.description}</p>

        {badges.length > 1 && (
          <p className="text-xs text-brand-primary mb-4">
            +{badges.length - 1} more badge{badges.length > 2 ? 's' : ''} earned!
          </p>
        )}

        <button
          onClick={handleDismiss}
          className="w-full py-3 bg-brand-primary text-white font-semibold rounded-2xl hover:bg-brand-primary/90 transition-colors min-h-[48px]"
        >
          Awesome!
        </button>
      </div>

      {/* CSS animations */}
      <style>{`
        .badge-icon-pop {
          animation: badgePop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }
        @keyframes badgePop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        .badge-unlock-container {
          animation: slideUp 0.4s ease-out forwards;
        }
        @keyframes slideUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .confetti-dot {
          animation: confettiFall linear forwards;
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
