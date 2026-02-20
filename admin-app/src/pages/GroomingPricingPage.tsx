import { useState, useEffect } from 'react';
import { adminGroomingApi } from '../lib/api';
import type { GroomingPriceTier } from '../lib/api';

const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'XL',
};

const SIZE_ORDER = ['small', 'medium', 'large', 'xl'];

const CONDITION_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'Slightly Matted',
  3: 'Moderately Matted',
  4: 'Heavy',
  5: 'Severe',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

interface EditingCell {
  tierId: string;
  field: 'price' | 'minutes';
  value: string;
}

export function GroomingPricingPage() {
  const [matrix, setMatrix] = useState<GroomingPriceTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminGroomingApi.getMatrix();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setMatrix(result.data.matrix);
    }
  };

  const getTier = (size: string, condition: number): GroomingPriceTier | undefined => {
    return matrix.find((t) => t.sizeCategory === size && t.conditionRating === condition);
  };

  const handleStartEdit = (tierId: string, field: 'price' | 'minutes', currentValue: number) => {
    setEditing({
      tierId,
      field,
      value: field === 'price' ? (currentValue / 100).toFixed(2) : String(currentValue),
    });
    setSaveSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editing) return;

    setIsSaving(true);
    setSaveError(null);
    const data: { priceCents?: number; estimatedMinutes?: number } = {};

    if (editing.field === 'price') {
      const cents = parseDollars(editing.value);
      if (cents === null) {
        setIsSaving(false);
        setSaveError('Please enter a valid price (e.g., 45.00)');
        return;
      }
      data.priceCents = cents;
    } else {
      const mins = parseInt(editing.value, 10);
      if (isNaN(mins) || mins < 0) {
        setIsSaving(false);
        setSaveError('Please enter a valid number of minutes');
        return;
      }
      data.estimatedMinutes = mins;
    }

    const result = await adminGroomingApi.updatePrice(editing.tierId, data);
    setIsSaving(false);

    if (result.data) {
      // API returns { tier: {...} }, extract the tier object
      const updated = (result.data as any).tier ?? result.data;
      setMatrix((prev) =>
        prev.map((t) => (t.id === editing.tierId ? updated : t)),
      );
      setSaveSuccess(editing.tierId);
      setEditing(null);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(null), 2000);
    } else if (result.error) {
      setSaveError(result.error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Grooming Pricing</h1>
        <div className="bg-white rounded-lg shadow p-8 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Grooming Pricing</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <button onClick={loadMatrix} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-brand-navy">Grooming Pricing</h1>
        <p className="text-gray-500 text-sm mt-1">Click any cell to edit price or estimated time</p>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-red-800 text-sm">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-600 hover:text-red-800 text-sm font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Desktop: Table view */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-brand-navy text-white">
              <th className="px-4 py-3 text-left text-sm font-semibold">Size</th>
              {[1, 2, 3, 4, 5].map((c) => (
                <th key={c} className="px-4 py-3 text-center text-sm font-semibold">
                  <div>{c}</div>
                  <div className="text-xs font-normal opacity-80">{CONDITION_LABELS[c]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_ORDER.map((size) => (
              <tr key={size} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold text-brand-navy">
                  {SIZE_LABELS[size]}
                </td>
                {[1, 2, 3, 4, 5].map((condition) => {
                  const tier = getTier(size, condition);
                  if (!tier) {
                    return <td key={condition} className="px-4 py-3 text-center text-gray-400">--</td>;
                  }

                  const isEditing = editing?.tierId === tier.id;
                  const justSaved = saveSuccess === tier.id;

                  return (
                    <td key={condition} className="px-2 py-2">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editing.field === 'price' ? editing.value : (tier.priceCents / 100).toFixed(2)}
                              onChange={(e) =>
                                editing.field === 'price' && setEditing({ ...editing, value: e.target.value })
                              }
                              onFocus={() => {
                                if (editing.field !== 'price') {
                                  handleStartEdit(tier.id, 'price', tier.priceCents);
                                }
                              }}
                              className="w-20 px-2 py-1 border border-brand-blue rounded text-sm text-center"
                              autoFocus={editing.field === 'price'}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editing.field === 'minutes' ? editing.value : tier.estimatedMinutes}
                              onChange={(e) =>
                                editing.field === 'minutes' && setEditing({ ...editing, value: e.target.value })
                              }
                              onFocus={() => {
                                if (editing.field !== 'minutes') {
                                  handleStartEdit(tier.id, 'minutes', tier.estimatedMinutes);
                                }
                              }}
                              className="w-20 px-2 py-1 border border-brand-blue rounded text-sm text-center"
                              autoFocus={editing.field === 'minutes'}
                            />
                            <span className="text-xs text-gray-500">min</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={handleSave}
                              disabled={isSaving}
                              className="flex-1 px-2 py-1 bg-brand-blue text-white rounded text-xs font-medium hover:bg-brand-blue-dark"
                            >
                              {isSaving ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(tier.id, 'price', tier.priceCents)}
                          className={`w-full text-center rounded-lg p-2 transition-colors ${
                            justSaved
                              ? 'bg-[#7FB685]/10 ring-2 ring-[#7FB685]'
                              : 'hover:bg-brand-cream'
                          }`}
                        >
                          <div className="text-sm font-semibold text-brand-navy">
                            {formatCents(tier.priceCents)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tier.estimatedMinutes} min
                          </div>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-4">
        {SIZE_ORDER.map((size) => (
          <div key={size} className="bg-white rounded-lg shadow">
            <div className="bg-brand-navy text-white px-4 py-2.5 rounded-t-lg font-semibold">
              {SIZE_LABELS[size]}
            </div>
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((condition) => {
                const tier = getTier(size, condition);
                if (!tier) return null;

                const isEditing = editing?.tierId === tier.id;
                const justSaved = saveSuccess === tier.id;

                return (
                  <div
                    key={condition}
                    className={`px-4 py-3 ${justSaved ? 'bg-[#7FB685]/10' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {condition}. {CONDITION_LABELS[condition]}
                        </span>
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEdit(tier.id, 'price', tier.priceCents)}
                          className="text-right"
                        >
                          <div className="text-sm font-semibold text-brand-navy">
                            {formatCents(tier.priceCents)}
                          </div>
                          <div className="text-xs text-gray-500">{tier.estimatedMinutes} min</div>
                        </button>
                      )}
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editing.field === 'price' ? editing.value : (tier.priceCents / 100).toFixed(2)}
                            onChange={(e) =>
                              editing.field === 'price' && setEditing({ ...editing, value: e.target.value })
                            }
                            className="w-20 px-2 py-1.5 border border-brand-blue rounded text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editing.field === 'minutes' ? editing.value : tier.estimatedMinutes}
                            onChange={(e) =>
                              editing.field === 'minutes' && setEditing({ ...editing, value: e.target.value })
                            }
                            className="w-16 px-2 py-1.5 border rounded text-sm"
                          />
                          <span className="text-xs text-gray-500">min</span>
                        </div>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="min-h-[36px] px-3 py-1.5 bg-brand-blue text-white rounded text-sm font-medium"
                        >
                          {isSaving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="min-h-[36px] px-2 py-1.5 text-gray-500 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
