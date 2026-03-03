import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface WelcomeModalProps {
  onContinue: () => void;
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    text: 'Book grooming appointments',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: "Track your pup's visits and health",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    text: 'Earn loyalty rewards',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    text: 'Message us anytime',
  },
];

export function WelcomeModal({ onContinue }: WelcomeModalProps) {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);

  const handleContinue = () => {
    setIsExiting(true);
    setTimeout(() => {
      onContinue();
    }, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-250 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop — not dismissible */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className={`relative w-full sm:max-w-[400px] mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transition-transform duration-300 ${
          isExiting ? 'translate-y-8 sm:scale-95' : 'translate-y-0 sm:scale-100'
        }`}
      >
        {/* Header accent */}
        <div
          className="h-1.5"
          style={{ background: 'linear-gradient(90deg, #62A2C3, #1B365D)' }}
        />

        <div className="px-6 pt-6 pb-8">
          {/* Paw icon + Heading */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">{'\u{1F43E}'}</span>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-brand-navy">
                Hello!
              </h2>
            </div>
          </div>

          <p className="font-body text-brand-navy/80 text-base mt-3 leading-relaxed">
            Thank you for trusting us with the care of your pet.
          </p>

          {/* Feature list */}
          <div className="mt-6 space-y-4">
            <p className="font-body text-sm font-semibold text-brand-navy/60 uppercase tracking-wider">
              With this app you can
            </p>
            {FEATURES.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0 text-brand-blue">
                  {feature.icon}
                </div>
                <p className="font-body text-sm text-brand-navy leading-snug">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>

          {/* Terms footer */}
          <p className="font-body text-xs text-brand-navy/50 mt-6 leading-relaxed text-center">
            By clicking Continue you agree to our{' '}
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="text-brand-blue underline underline-offset-2 hover:text-brand-blue/80"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="text-brand-blue underline underline-offset-2 hover:text-brand-blue/80"
            >
              Privacy Policy
            </button>
          </p>

          {/* Continue button */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full mt-5 py-3.5 bg-brand-blue text-white font-body font-semibold text-base rounded-xl shadow-md hover:bg-brand-blue/90 active:scale-[0.98] transition-all min-h-[48px]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
