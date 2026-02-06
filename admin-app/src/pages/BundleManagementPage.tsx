import { useState, useEffect } from 'react';
import { adminBundleApi, adminBookingApi } from '../lib/api';
import type { ServiceBundle, ServiceType } from '../lib/api';
import { Modal } from '../components/ui';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface BundleFormData {
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  serviceTypeIds: string[];
  sortOrder: string;
}

const EMPTY_FORM: BundleFormData = {
  name: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  serviceTypeIds: [],
  sortOrder: '0',
};

export function BundleManagementPage() {
  const [bundles, setBundles] = useState<ServiceBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);

  useEffect(() => {
    loadBundles();
    adminBookingApi.getServiceTypes().then(({ data }) => {
      if (data) setServiceTypes(data.serviceTypes);
    });
  }, []);

  const loadBundles = async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminBundleApi.list();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setBundles(result.data.bundles);
    }
  };

  const handleToggle = async (bundleId: string) => {
    const result = await adminBundleApi.toggle(bundleId);
    if (result.data) {
      const updated = (result.data as any).bundle ?? result.data;
      setBundles((prev) => prev.map((b) => (b.id === bundleId ? { ...b, isActive: updated.isActive } : b)));
    }
  };

  const handleEdit = (bundle: ServiceBundle) => {
    setEditingId(bundle.id);
    setForm({
      name: bundle.name,
      description: bundle.description || '',
      discountType: bundle.discountType,
      discountValue: String(bundle.discountValue),
      serviceTypeIds: bundle.items.map((i) => i.serviceType.id),
      sortOrder: String(bundle.sortOrder),
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('Bundle name is required');
      return;
    }
    const discountValue = parseFloat(form.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      setFormError('Please enter a valid discount value');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue,
      serviceTypeIds: form.serviceTypeIds,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };

    const result = editingId
      ? await adminBundleApi.update(editingId, payload)
      : await adminBundleApi.create(payload as Parameters<typeof adminBundleApi.create>[0]);

    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else if (result.data) {
      const bundle = (result.data as any).bundle ?? result.data;
      if (editingId) {
        setBundles((prev) => prev.map((b) => (b.id === editingId ? bundle : b)));
      } else {
        setBundles((prev) => [...prev, bundle]);
      }
      setShowForm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Service Bundles</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-brand-navy mb-6">Service Bundles</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <button onClick={loadBundles} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">Service Bundles</h1>
          <p className="text-gray-500 text-sm mt-1">Manage bundled service discounts</p>
        </div>
        <button
          onClick={handleCreate}
          className="min-h-[44px] px-4 py-2.5 bg-brand-teal text-white rounded-lg font-medium hover:bg-brand-teal-dark transition-colors"
        >
          Create Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 font-medium">No bundles yet</p>
          <p className="text-gray-400 text-sm mt-1">Create a bundle to offer service discounts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-brand-navy truncate">{bundle.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        bundle.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {bundle.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {bundle.description && (
                    <p className="text-sm text-gray-500 mb-2">{bundle.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {bundle.items.map((item) => (
                      <span
                        key={item.id}
                        className="px-2 py-0.5 bg-brand-cream text-brand-navy rounded text-xs font-medium"
                      >
                        {item.serviceType.displayName} ({formatCents(item.serviceType.basePriceCents)})
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-brand-teal-dark font-medium">
                    Discount: {bundle.discountType === 'percentage'
                      ? `${bundle.discountValue}%`
                      : formatCents(bundle.discountValue)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(bundle.id)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      bundle.isActive ? 'bg-brand-soft-green' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        bundle.isActive ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleEdit(bundle)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-brand-navy transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit Bundle' : 'Create Bundle'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Spa Day Package"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value
              </label>
              <input
                type="number"
                min="0"
                step={form.discountType === 'percentage' ? '1' : '0.01'}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                placeholder={form.discountType === 'percentage' ? '10' : '5.00'}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Services (select at least 2)
            </label>
            <div className="space-y-2">
              {serviceTypes.map((st) => {
                const isChecked = form.serviceTypeIds.includes(st.id);
                return (
                  <label key={st.id} className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setForm((prev) => ({
                          ...prev,
                          serviceTypeIds: isChecked
                            ? prev.serviceTypeIds.filter((id) => id !== st.id)
                            : [...prev.serviceTypeIds, st.id],
                        }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-sm text-gray-700">
                      {st.displayName} ({formatCents(st.basePriceCents)})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]"
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-brand-teal text-white rounded-lg font-medium hover:bg-brand-teal-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
