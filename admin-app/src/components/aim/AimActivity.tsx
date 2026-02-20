import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminDashboardApi, adminMessagingApi } from '../../lib/api';

interface ActivityItem {
  id: string;
  type: 'check_in' | 'check_out' | 'booking' | 'escalation';
  description: string;
  timestamp: string;
  link?: string;
}

const DOT_COLORS: Record<ActivityItem['type'], string> = {
  check_in: 'bg-[#7FB685]',
  check_out: 'bg-[#62A2C3]',
  booking: 'bg-[#1B365D]',
  escalation: 'bg-[#E8837B]',
};

function formatRelativeTime(dateStr: string): string {
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

export function AimActivity() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const [arrivalsResult, escalatedResult] = await Promise.all([
      adminDashboardApi.getArrivals(today),
      adminMessagingApi.getConversations('escalated'),
    ]);

    const activityItems: ActivityItem[] = [];

    // Process arrivals/departures
    if (arrivalsResult.data) {
      const data = arrivalsResult.data;
      const arrivals = data.arrivals ?? data.checkedIn ?? [];
      const departures = data.departures ?? data.checkedOut ?? [];

      for (const a of arrivals) {
        const dogName = a.dogName ?? a.dog?.name ?? 'Dog';
        const ownerName = a.ownerName ?? a.customer?.firstName ?? '';
        activityItems.push({
          id: `arrival-${a.id ?? a.bookingId ?? Math.random()}`,
          type: 'check_in',
          description: `${dogName} checked in${ownerName ? ` (${ownerName})` : ''}`,
          timestamp: a.checkInTime ?? a.time ?? a.createdAt ?? new Date().toISOString(),
          link: `/schedule`,
        });
      }

      for (const d of departures) {
        const dogName = d.dogName ?? d.dog?.name ?? 'Dog';
        activityItems.push({
          id: `departure-${d.id ?? d.bookingId ?? Math.random()}`,
          type: 'check_out',
          description: `${dogName} checked out`,
          timestamp: d.checkOutTime ?? d.time ?? d.createdAt ?? new Date().toISOString(),
          link: `/schedule`,
        });
      }
    }

    // Process escalated messages
    if (escalatedResult.data) {
      const convs = escalatedResult.data.conversations ?? escalatedResult.data ?? [];
      for (const conv of Array.isArray(convs) ? convs : []) {
        const name = conv.customer
          ? `${conv.customer.firstName ?? ''} ${conv.customer.lastName ?? ''}`.trim()
          : 'Customer';
        activityItems.push({
          id: `escalation-${conv.id}`,
          type: 'escalation',
          description: `Message escalated: ${name}`,
          timestamp: conv.lastMessageAt ?? conv.updatedAt ?? conv.createdAt ?? new Date().toISOString(),
          link: `/messages?filter=escalated`,
        });
      }
    }

    // Sort newest first, cap at 50
    activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(activityItems.slice(0, 50));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#62A2C3] rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">No recent activity</p>
        <p className="text-xs text-gray-400 mt-1">Events will appear here as the day progresses</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (item.link) navigate(item.link);
          }}
          className="w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-[#F8F6F3] transition-colors flex items-start gap-2.5 min-h-[44px]"
        >
          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${DOT_COLORS[item.type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#1B365D] leading-snug">{item.description}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(item.timestamp)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
