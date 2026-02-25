function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Pure calculation — no side effects
function calculateTotal(basePriceCents: number, addOns: { priceCents: number }[]): number {
  return basePriceCents + addOns.reduce((sum, a) => sum + a.priceCents, 0);
}

interface GroomingQuoteSummaryProps {
  basePriceCents: number;
  serviceName: string;
  sizeCategory?: string | null;
  selectedAddOns: { name: string; priceCents: number }[];
}

export function GroomingQuoteSummary({
  basePriceCents,
  serviceName,
  sizeCategory,
  selectedAddOns,
}: GroomingQuoteSummaryProps) {
  const total = calculateTotal(basePriceCents, selectedAddOns);

  return (
    <div className="bg-brand-sage/10 border border-brand-sage/30 rounded-2xl p-4">
      <h4 className="font-heading font-bold text-brand-forest text-sm mb-3">Price Estimate</h4>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-brand-forest-muted">
            {serviceName}
            {sizeCategory && <span className="text-xs"> ({sizeCategory})</span>}
          </span>
          <span className="font-medium text-brand-forest">{formatPrice(basePriceCents)}</span>
        </div>
        {selectedAddOns.map((addOn) => (
          <div key={addOn.name} className="flex justify-between text-sm">
            <span className="text-brand-forest-muted">{addOn.name}</span>
            <span className="font-medium text-brand-forest">+{formatPrice(addOn.priceCents)}</span>
          </div>
        ))}
        <div className="border-t border-brand-sage/30 pt-2 mt-2 flex justify-between">
          <span className="font-bold text-brand-forest">Estimated Total</span>
          <span className="font-bold text-brand-forest text-lg">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}
