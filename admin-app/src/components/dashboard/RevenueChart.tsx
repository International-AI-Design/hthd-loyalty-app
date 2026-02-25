import { useState, useEffect, useCallback } from 'react';
import { adminAnalyticsApi } from '../../lib/api';
import type { RevenueSnapshot } from '../../lib/api';

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-400">--</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center text-xs font-semibold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      <svg className={`w-3 h-3 mr-0.5 ${isUp ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
      {Math.abs(value)}%
    </span>
  );
}

export function RevenueChart() {
  const [data, setData] = useState<RevenueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminAnalyticsApi.getRevenue();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-100 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Revenue</h2>
        <button
          onClick={fetchRevenue}
          className="text-xs text-[#62A2C3] hover:text-[#4F8BA8] font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-[#F8F6F3]">
            <p className="text-xs text-gray-500 mb-1">Today</p>
            <p className="text-xl font-bold text-[#1B365D]">
              ${data.today.toFixed(0)}
            </p>
            <ChangeIndicator value={data.todayChange} />
          </div>
          <div className="p-3 rounded-lg bg-[#F8F6F3]">
            <p className="text-xs text-gray-500 mb-1">This Week</p>
            <p className="text-xl font-bold text-[#1B365D]">
              ${data.thisWeek.toFixed(0)}
            </p>
            <ChangeIndicator value={data.weekChange} />
          </div>
          <div className="p-3 rounded-lg bg-[#F8F6F3]">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-xl font-bold text-[#1B365D]">
              ${data.thisMonth.toFixed(0)}
            </p>
            <ChangeIndicator value={data.monthChange} />
          </div>
        </div>
      )}

      {!data && !error && (
        <p className="text-sm text-gray-400 text-center py-4">No revenue data available</p>
      )}
    </div>
  );
}
