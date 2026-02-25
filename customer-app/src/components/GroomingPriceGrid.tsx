import { useState, useEffect } from 'react';
import { match } from 'ts-pattern';
import { groomingApi } from '../lib/api';
import type { PricingSheet } from '../lib/api';
import type { FetchState } from '../lib/types';

const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'XL',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface GroomingPriceGridProps {
  dogSize?: string | null;
  selectedSubServiceId?: string | null;
  onSubServiceSelect?: (subServiceId: string, priceCents: number) => void;
}

export function GroomingPriceGrid({ dogSize, selectedSubServiceId, onSubServiceSelect }: GroomingPriceGridProps) {
  const [state, setState] = useState<FetchState<PricingSheet>>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    groomingApi.getPricingSheet().then((res) => {
      if (res.data) {
        setState({ status: 'success', data: res.data });
      } else {
        setState({ status: 'error', error: res.error || 'Failed to load pricing' });
      }
    }).catch(() => {
      setState({ status: 'error', error: 'Failed to load pricing' });
    });
  }, []);

  return match(state)
    .with({ status: 'idle' }, () => null)
    .with({ status: 'loading' }, () => (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-24" />
          </div>
        ))}
      </div>
    ))
    .with({ status: 'error' }, ({ error }) => (
      <div className="bg-brand-error/10 border border-brand-error/20 rounded-2xl p-4 text-center">
        <p className="text-brand-error text-sm font-medium">{error}</p>
        <button
          onClick={() => {
            setState({ status: 'loading' });
            groomingApi.getPricingSheet().then((res) => {
              if (res.data) setState({ status: 'success', data: res.data });
              else setState({ status: 'error', error: res.error || 'Failed to load pricing' });
            }).catch(() => setState({ status: 'error', error: 'Failed to load pricing' }));
          }}
          className="text-brand-primary text-sm mt-2 underline"
        >
          Try again
        </button>
      </div>
    ))
    .with({ status: 'success' }, ({ data }) => (
      <div className="space-y-3">
        {data.subServices.map((ss) => {
          const priceForDog = dogSize
            ? ss.prices.find((p) => p.sizeCategory === dogSize)
            : null;
          const isSelected = selectedSubServiceId === ss.id;

          return (
            <button
              key={ss.id}
              type="button"
              onClick={() => {
                if (onSubServiceSelect && priceForDog) {
                  onSubServiceSelect(ss.id, priceForDog.priceCents);
                } else if (onSubServiceSelect && ss.prices.length > 0) {
                  onSubServiceSelect(ss.id, ss.prices[0].priceCents);
                }
              }}
              className={`w-full text-left rounded-2xl p-4 transition-all min-h-[56px] ${
                isSelected
                  ? 'bg-brand-primary/10 border-2 border-brand-primary shadow-glow'
                  : 'bg-white border-2 border-transparent hover:border-brand-primary/30 shadow-warm-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-heading font-bold text-brand-forest text-base">
                    {ss.displayName}
                  </h4>
                  {ss.description && (
                    <p className="text-sm text-brand-forest-muted mt-0.5 line-clamp-2">
                      {ss.description}
                    </p>
                  )}
                  {ss.isCoatRelated && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-brand-amber/20 text-brand-amber-dark text-xs rounded-full font-medium">
                      Coat service
                    </span>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  {priceForDog ? (
                    <span className="text-lg font-bold text-brand-forest">
                      {formatPrice(priceForDog.priceCents)}
                    </span>
                  ) : ss.prices.length > 0 ? (
                    <div>
                      <span className="text-sm font-semibold text-brand-forest">
                        {formatPrice(Math.min(...ss.prices.map((p) => p.priceCents)))}
                      </span>
                      {ss.prices.length > 1 && (
                        <span className="text-xs text-brand-forest-muted"> - {formatPrice(Math.max(...ss.prices.map((p) => p.priceCents)))}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-brand-forest-muted">Price varies</span>
                  )}
                  {dogSize && priceForDog && (
                    <p className="text-xs text-brand-forest-muted">{SIZE_LABELS[dogSize] || dogSize}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    ))
    .exhaustive();
}
