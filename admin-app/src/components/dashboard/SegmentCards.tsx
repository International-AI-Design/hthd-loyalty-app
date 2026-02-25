import { useState, useEffect, useCallback } from 'react';
import { adminAnalyticsApi } from '../../lib/api';
import type { CustomerSegments } from '../../lib/api';

const SEGMENT_CONFIG = [
  { key: 'new' as const, label: 'New', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', icon: '🆕' },
  { key: 'active' as const, label: 'Active', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', icon: '✅' },
  { key: 'atRisk' as const, label: 'At-Risk', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', icon: '⚠️' },
  { key: 'churned' as const, label: 'Churned', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', icon: '📉' },
] as const;

export function SegmentCards() {
  const [data, setData] = useState<CustomerSegments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminAnalyticsApi.getSegments();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {SEGMENT_CONFIG.map((segment) => (
        <div
          key={segment.key}
          className={`${segment.bgColor} rounded-xl p-4 border border-gray-100`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg">{segment.icon}</span>
            <div className={`w-2 h-2 rounded-full ${segment.color}`} />
          </div>
          <p className={`text-2xl font-bold ${segment.textColor}`}>
            {data[segment.key]}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{segment.label}</p>
        </div>
      ))}
    </div>
  );
}
