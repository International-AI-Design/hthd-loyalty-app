import { useState, useEffect, useCallback } from 'react';
import { adminAnalyticsApi } from '../../lib/api';
import type { AimInsight } from '../../lib/api';

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  revenue: { label: 'Revenue', color: 'bg-emerald-100 text-emerald-700' },
  bookings: { label: 'Bookings', color: 'bg-blue-100 text-blue-700' },
  compliance: { label: 'Compliance', color: 'bg-amber-100 text-amber-700' },
  services: { label: 'Services', color: 'bg-purple-100 text-purple-700' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function InsightsPanel() {
  const [insights, setInsights] = useState<AimInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminAnalyticsApi.getInsights();
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setInsights(result.data.insights || []);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await adminAnalyticsApi.generateInsights();
    setIsGenerating(false);
    if (result.data) {
      fetchInsights();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Insights</h2>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-3 py-1.5 text-xs font-medium text-[#62A2C3] border border-[#62A2C3]/30 rounded-lg hover:bg-[#62A2C3]/5 transition-colors disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Refresh Insights'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-50 rounded-lg h-16" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 mb-3">No insights yet</p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-[#62A2C3] text-white text-sm font-medium rounded-lg hover:bg-[#5191b0] transition-colors disabled:opacity-50"
          >
            Generate Insights
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {insights.map((insight) => {
            const badge = TYPE_BADGES[insight.type] ?? { label: insight.type, color: 'bg-gray-100 text-gray-600' };
            return (
              <div
                key={insight.id}
                className="p-3 rounded-lg border border-gray-100 hover:border-[#62A2C3]/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
                      {badge.label}
                    </span>
                    <h3 className="text-sm font-medium text-[#1B365D]">{insight.title}</h3>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                    {formatRelativeTime(insight.generatedAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{insight.summary}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
