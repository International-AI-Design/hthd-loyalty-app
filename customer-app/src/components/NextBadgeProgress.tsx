import { useState, useEffect, useCallback } from 'react';
import { badgeApi } from '../lib/api';
import type { NextBadgeProgress as NextBadgeData } from '../lib/api';

export function NextBadgeProgress() {
  const [data, setData] = useState<NextBadgeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNext = useCallback(async () => {
    setIsLoading(true);
    const result = await badgeApi.getNextBadge();
    setIsLoading(false);
    if (result.data && result.data.badge) {
      setData(result.data);
    } else {
      setData(null);
    }
  }, []);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-4 animate-pulse">
        <div className="h-4 bg-brand-sand/60 rounded w-1/3 mb-2" />
        <div className="h-3 bg-brand-sand/40 rounded w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-forest truncate">
            Next: {data.displayName}
          </p>
          <p className="text-xs text-gray-500">{data.description}</p>
        </div>
        <span className="text-xs font-medium text-brand-primary whitespace-nowrap">
          {data.progress} of {data.target}
        </span>
      </div>
      <div className="w-full h-2.5 bg-brand-sand/40 rounded-full overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={data.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-full bg-brand-primary rounded-full transition-all duration-500"
          style={{ width: `${data.progressPct}%` }}
        />
      </div>
    </div>
  );
}
