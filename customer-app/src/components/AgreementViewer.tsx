import { useState } from 'react';
import { Button } from './ui';
import { TypeToSign } from './TypeToSign';
import type { ServiceAgreement } from '../lib/api';

interface AgreementViewerProps {
  agreement: ServiceAgreement;
  onSign: (typedName: string) => void;
  alreadySigned: boolean;
  signing?: boolean;
}

export function AgreementViewer({ agreement, onSign, alreadySigned, signing }: AgreementViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) setHasScrolledToBottom(true);
  }

  return (
    <div className="bg-white rounded-2xl shadow-warm border border-brand-sand/50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left min-h-[44px]"
      >
        <div className="flex items-center gap-3">
          {alreadySigned ? (
            <div className="w-8 h-8 rounded-full bg-brand-success/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-warning/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-amber-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="font-heading font-semibold text-brand-forest text-base">
              {agreement.displayName}
            </h3>
            <p className="text-sm text-brand-forest-muted">
              {alreadySigned ? 'Signed' : 'Signature required'}
              {' · v'}
              {agreement.version}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-brand-forest-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-brand-sand/50">
          <div
            className="p-4 max-h-64 overflow-y-auto text-sm text-brand-forest-light leading-relaxed whitespace-pre-wrap"
            onScroll={handleScroll}
          >
            {agreement.content}
          </div>

          {!alreadySigned && (
            <div className="p-4 border-t border-brand-sand/50 bg-brand-cream/50">
              {!hasScrolledToBottom && agreement.content.length > 500 ? (
                <p className="text-sm text-brand-forest-muted text-center">
                  Please scroll to read the full agreement before signing
                </p>
              ) : (
                <TypeToSign onSign={onSign} signing={signing} />
              )}
            </div>
          )}

          {alreadySigned && (
            <div className="px-4 pb-4">
              <Button variant="ghost" size="sm" disabled className="w-full opacity-70">
                Already signed
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
