import { useState, useEffect } from 'react';
import { match } from 'ts-pattern';
import { adminGroomingApi } from '../lib/api';
import type { GroomingPriceTier, GroomingServicePrice, GroomingAddOnAdmin } from '../lib/api';
import type { FetchState } from './grooming-pricing-types';

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

type ActiveTab = 'matrix' | 'service-prices' | 'add-ons';

export function GroomingPricingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('matrix');

  // Matrix state (existing)
  const [matrix, setMatrix] = useState<GroomingPriceTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Service prices state
  const [servicePricesState, setServicePricesState] = useState<FetchState<GroomingServicePrice[]>>({ status: 'idle' });

  // Add-ons state
  const [addOnsState, setAddOnsState] = useState<FetchState<GroomingAddOnAdmin[]>>({ status: 'idle' });
  const [newAddOn, setNewAddOn] = useState({ name: '', displayName: '', description: '', priceCents: '' });
  const [addOnSaveError, setAddOnSaveError] = useState<string | null>(null);
  const [isCreatingAddOn, setIsCreatingAddOn] = useState(false);

  useEffect(() => {
    loadMatrix();
  }, []);

  useEffect(() => {
    if (activeTab === 'service-prices' && servicePricesState.status === 'idle') {
      loadServicePrices();
    }
    if (activeTab === 'add-ons' && addOnsState.status === 'idle') {
      loadAddOns();
    }
  }, [activeTab, servicePricesState.status, addOnsState.status]);

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

  const loadServicePrices = async () => {
    setServicePricesState({ status: 'loading' });
    const result = await adminGroomingApi.getServicePrices();
    if (result.data) {
      setServicePricesState({ status: 'success', data: result.data.prices });
    } else {
      setServicePricesState({ status: 'error', error: result.error || 'Failed to load service prices' });
    }
  };

  const loadAddOns = async () => {
    setAddOnsState({ status: 'loading' });
    const result = await adminGroomingApi.getAddOns();
    if (result.data) {
      setAddOnsState({ status: 'success', data: result.data.addOns });
    } else {
      setAddOnsState({ status: 'error', error: result.error || 'Failed to load add-ons' });
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

  const handleCreateAddOn = async () => {
    const priceCents = parseDollars(newAddOn.priceCents);
    if (!newAddOn.name.trim() || !newAddOn.displayName.trim() || priceCents === null) {
      setAddOnSaveError('Name, display name, and a valid price are required.');
      return;
    }
    setIsCreatingAddOn(true);
    setAddOnSaveError(null);
    const result = await adminGroomingApi.createAddOn({
      name: newAddOn.name.trim(),
      displayName: newAddOn.displayName.trim(),
      description: newAddOn.description.trim() || undefined,
      priceCents,
    });
    setIsCreatingAddOn(false);
    if (result.data) {
      setAddOnsState((prev) =>
        prev.status === 'success' ? { ...prev, data: [...prev.data, result.data!.addOn] } : prev,
      );
      setNewAddOn({ name: '', displayName: '', description: '', priceCents: '' });
    } else {
      setAddOnSaveError(result.error || 'Failed to create add-on');
    }
  };

  const handleToggleAddOn = async (addOn: GroomingAddOnAdmin) => {
    const result = await adminGroomingApi.updateAddOn(addOn.id, { isActive: !addOn.isActive });
    if (result.data) {
      setAddOnsState((prev) =>
        prev.status === 'success'
          ? { ...prev, data: prev.data.map((a) => (a.id === addOn.id ? result.data!.addOn : a)) }
          : prev,
      );
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
        <p className="text-gray-500 text-sm mt-1">Manage condition matrix, service prices, and add-ons</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          { id: 'matrix' as const, label: 'Condition Matrix' },
          { id: 'service-prices' as const, label: 'Service Prices' },
          { id: 'add-ons' as const, label: 'Add-Ons' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-brand-blue text-brand-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-red-800 text-sm">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-600 hover:text-red-800 text-sm font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab: Condition Matrix */}
      {activeTab === 'matrix' && (
        <>
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
        </>
      )}

      {/* Tab: Service Prices */}
      {activeTab === 'service-prices' && match(servicePricesState)
        .with({ status: 'idle' }, () => null)
        .with({ status: 'loading' }, () => (
          <div className="bg-white rounded-lg shadow p-8 animate-pulse">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))
        .with({ status: 'error' }, ({ error: err }) => (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">{err}</p>
            <button onClick={loadServicePrices} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
              Try again
            </button>
          </div>
        ))
        .with({ status: 'success' }, ({ data: prices }) => {
          // Group prices by sub-service
          const grouped = prices.reduce<Record<string, GroomingServicePrice[]>>((acc, p) => {
            const key = p.subService.displayName;
            if (!acc[key]) acc[key] = [];
            acc[key].push(p);
            return acc;
          }, {});

          return (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Service</th>
                    {SIZE_ORDER.map((s) => (
                      <th key={s} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{SIZE_LABELS[s]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([serviceName, servicePrices]) => (
                    <tr key={serviceName} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-brand-navy">{serviceName}</td>
                      {SIZE_ORDER.map((size) => {
                        const sp = servicePrices.find((p) => p.sizeCategory === size);
                        return (
                          <td key={size} className="px-4 py-3 text-center">
                            {sp ? (
                              <span className={`text-sm font-semibold ${sp.isActive ? 'text-brand-navy' : 'text-gray-400 line-through'}`}>
                                {formatCents(sp.priceCents)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">--</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {prices.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No service prices configured yet. Add prices via the database or API.
                </div>
              )}
            </div>
          );
        })
        .exhaustive()
      }

      {/* Tab: Add-Ons */}
      {activeTab === 'add-ons' && (
        <div className="space-y-6">
          {/* Create new add-on form */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-brand-navy mb-4">Create New Add-On</h3>
            {addOnSaveError && (
              <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 text-sm text-red-800">
                {addOnSaveError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (internal)</label>
                <input
                  type="text"
                  value={newAddOn.name}
                  onChange={(e) => setNewAddOn((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., nail-painting"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newAddOn.displayName}
                  onChange={(e) => setNewAddOn((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g., Nail Painting"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newAddOn.description}
                  onChange={(e) => setNewAddOn((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAddOn.priceCents}
                  onChange={(e) => setNewAddOn((p) => ({ ...p, priceCents: e.target.value }))}
                  placeholder="e.g., 15.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCreateAddOn}
              disabled={isCreatingAddOn}
              className="mt-4 px-4 py-2 bg-brand-blue text-white rounded text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50"
            >
              {isCreatingAddOn ? 'Creating...' : 'Create Add-On'}
            </button>
          </div>

          {/* Add-ons list */}
          {match(addOnsState)
            .with({ status: 'idle' }, () => null)
            .with({ status: 'loading' }, () => (
              <div className="bg-white rounded-lg shadow p-8 animate-pulse">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded" />
                  ))}
                </div>
              </div>
            ))
            .with({ status: 'error' }, ({ error: err }) => (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-800 font-medium">{err}</p>
                <button onClick={loadAddOns} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
                  Try again
                </button>
              </div>
            ))
            .with({ status: 'success' }, ({ data: addOns }) => (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Display Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Price</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addOns.map((addOn) => (
                      <tr key={addOn.id} className={`border-t border-gray-100 ${!addOn.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{addOn.name}</td>
                        <td className="px-4 py-3 text-sm font-medium text-brand-navy">{addOn.displayName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{addOn.description || '--'}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-brand-navy">
                          {formatCents(addOn.priceCents)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            addOn.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {addOn.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleAddOn(addOn)}
                            className="text-sm text-brand-blue hover:text-brand-blue-dark font-medium"
                          >
                            {addOn.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {addOns.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No add-ons yet. Create one above.
                  </div>
                )}
              </div>
            ))
            .exhaustive()
          }
        </div>
      )}
    </div>
  );
}
