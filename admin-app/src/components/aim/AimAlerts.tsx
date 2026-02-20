import { useState, useEffect, useCallback } from 'react';
import { useAim } from '../../contexts/AimContext';
import { adminAimApi } from '../../lib/api';
import type { AimAlert } from '../../lib/api';

const SEVERITY_STYLES: Record<string, { icon: string; bg: string; iconBg: string }> = {
  info: {
    icon: 'text-[#62A2C3]',
    bg: 'bg-[#62A2C3]/5',
    iconBg: 'bg-[#62A2C3]/15',
  },
  warning: {
    icon: 'text-[#F5C65D]',
    bg: 'bg-[#F5C65D]/5',
    iconBg: 'bg-[#F5C65D]/15',
  },
  critical: {
    icon: 'text-[#E8837B]',
    bg: 'bg-[#E8837B]/5',
    iconBg: 'bg-[#E8837B]/15',
  },
};

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function formatAlertTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AimAlerts() {
  const { askAim, refreshAlertCount } = useAim();
  const [alerts, setAlerts] = useState<AimAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    const result = await adminAimApi.getAlerts();
    if (result.data) {
      // Show unread alerts (no readAt)
      setAlerts((result.data.alerts ?? []).filter((a) => !a.readAt));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleDismiss = async (id: string) => {
    await adminAimApi.markAlertRead(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    refreshAlertCount();
  };

  const handleAskAim = (alert: AimAlert) => {
    askAim(`Tell me about this alert: ${alert.title}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[#7FB685]/10 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#7FB685]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[#1B365D]">No alerts</p>
        <p className="text-xs text-gray-400 mt-1">Everything looks good!</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
        return (
          <div
            key={alert.id}
            className={`px-3 py-3 border-b border-gray-50 ${style.bg}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`w-7 h-7 rounded-full ${style.iconBg} ${style.icon} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <SeverityIcon severity={alert.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1B365D]">{alert.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">{formatAlertTime(alert.createdAt)}</p>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[32px]"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleAskAim(alert)}
                    className="px-2.5 py-1 text-xs font-medium text-[#4F8BA8] bg-[#62A2C3]/10 rounded-lg hover:bg-[#62A2C3]/20 transition-colors min-h-[32px]"
                  >
                    Ask AIM
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
