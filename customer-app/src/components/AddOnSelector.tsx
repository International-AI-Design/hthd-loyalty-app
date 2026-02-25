import type { GroomingAddOn } from '../lib/api';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface AddOnSelectorProps {
  addOns: GroomingAddOn[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function AddOnSelector({ addOns, selectedIds, onToggle }: AddOnSelectorProps) {
  if (addOns.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-heading font-bold text-brand-forest text-base">Add-Ons</h4>
      <p className="text-sm text-brand-forest-muted mb-2">
        Enhance your pup's spa day with these extras.
      </p>
      <div className="space-y-2">
        {addOns.map((addOn) => {
          const isSelected = selectedIds.includes(addOn.id);
          return (
            <button
              key={addOn.id}
              type="button"
              onClick={() => onToggle(addOn.id)}
              className={`w-full text-left rounded-2xl p-4 transition-all min-h-[48px] flex items-center justify-between ${
                isSelected
                  ? 'bg-brand-primary/10 border-2 border-brand-primary'
                  : 'bg-white border-2 border-transparent hover:border-brand-primary/30 shadow-warm-sm'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'bg-brand-primary' : 'border-2 border-brand-sand'
                }`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-brand-forest text-sm">
                    {addOn.displayName}
                  </span>
                  {addOn.description && (
                    <p className="text-xs text-brand-forest-muted mt-0.5 line-clamp-1">
                      {addOn.description}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-bold text-brand-forest ml-3 flex-shrink-0">
                +{formatPrice(addOn.priceCents)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
