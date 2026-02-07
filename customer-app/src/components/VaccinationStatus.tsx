import { useState, useEffect } from 'react';
import { dogProfileApi } from '../lib/api';

interface ComplianceItem {
  requirement: string;
  description: string | null;
  status: 'compliant' | 'expired' | 'missing';
  lastGiven: string | null;
  expiresAt: string | null;
  verified?: boolean;
  gracePeriodDays: number;
}

interface ComplianceResponse {
  dogId: string;
  compliance: ComplianceItem[];
  isFullyCompliant: boolean;
}

interface VaccinationStatusProps {
  dogId: string;
  dogName?: string;
  compact?: boolean;
}

export function VaccinationStatus({ dogId, dogName, compact = false }: VaccinationStatusProps) {
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const { data, error: err } = await dogProfileApi.getCompliance(dogId);
      if (data) {
        setCompliance(data as ComplianceResponse);
      } else if (err) {
        setError(err);
      }
      setIsLoading(false);
    };
    load();
  }, [dogId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-xl text-sm text-red-600">
        Unable to load vaccination status.
      </div>
    );
  }

  if (!compliance || compliance.compliance.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
        No vaccination requirements configured.
      </div>
    );
  }

  const compliantCount = compliance.compliance.filter((c) => c.status === 'compliant').length;
  const totalCount = compliance.compliance.length;

  const isExpiringSoon = (item: ComplianceItem) => {
    if (item.status !== 'compliant' || !item.expiresAt) return false;
    const expires = new Date(item.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const formatDate = (dateStr: string) => {
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusIcon = (item: ComplianceItem) => {
    if (item.status === 'compliant' && !isExpiringSoon(item)) {
      return (
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    if (item.status === 'compliant' && isExpiringSoon(item)) {
      return (
        <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      );
    }
    // expired or missing
    return (
      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  };

  const statusLabel = (item: ComplianceItem) => {
    if (item.status === 'compliant' && isExpiringSoon(item)) return 'Expiring Soon';
    if (item.status === 'compliant') return 'Current';
    if (item.status === 'expired') return 'Expired';
    return 'Missing';
  };

  const statusColor = (item: ComplianceItem) => {
    if (item.status === 'compliant' && isExpiringSoon(item)) return 'text-yellow-600';
    if (item.status === 'compliant') return 'text-green-600';
    return 'text-red-600';
  };

  // Summary bar percentage
  const barPct = totalCount > 0 ? (compliantCount / totalCount) * 100 : 0;
  const barColor = compliance.isFullyCompliant ? '#22c55e' : compliantCount > 0 ? '#eab308' : '#ef4444';

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-navy">
            Vaccinations
          </span>
          <span className={`text-sm font-semibold ${compliance.isFullyCompliant ? 'text-green-600' : 'text-red-600'}`}>
            {compliantCount}/{totalCount} current
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${barPct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Summary */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-bold text-brand-navy">
          {dogName ? `${dogName}'s Vaccinations` : 'Vaccination Status'}
        </h3>
        <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
          compliance.isFullyCompliant
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {compliantCount}/{totalCount} current
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barPct}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Individual requirements */}
      <div className="space-y-2">
        {compliance.compliance.map((item) => (
          <div
            key={item.requirement}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
          >
            {statusIcon(item)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-navy truncate">
                {item.requirement}
              </p>
              {item.expiresAt && item.status === 'compliant' && (
                <p className={`text-xs ${isExpiringSoon(item) ? 'text-yellow-600' : 'text-gray-500'}`}>
                  Expires {formatDate(item.expiresAt)}
                </p>
              )}
              {item.status === 'expired' && item.expiresAt && (
                <p className="text-xs text-red-500">
                  Expired {formatDate(item.expiresAt)}
                </p>
              )}
              {item.status === 'missing' && (
                <p className="text-xs text-red-500">
                  No record on file
                </p>
              )}
            </div>
            <span className={`text-xs font-semibold ${statusColor(item)}`}>
              {statusLabel(item)}
            </span>
          </div>
        ))}
      </div>

      {/* Link to add missing vaccinations */}
      {!compliance.isFullyCompliant && (
        <p className="text-xs text-gray-500 text-center">
          Contact us or bring vaccination records to your next visit to update.
        </p>
      )}
    </div>
  );
}
