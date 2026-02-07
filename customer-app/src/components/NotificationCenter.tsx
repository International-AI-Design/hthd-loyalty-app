import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';

export interface Notification {
  id: string;
  type: 'booking' | 'pet_update' | 'message' | 'reward' | 'system';
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  petName?: string;
}

interface NotificationBellProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Notification context for app-wide use
const notificationListeners = new Set<(n: Notification) => void>();

export function onNotification(listener: (n: Notification) => void): () => void {
  notificationListeners.add(listener);
  return () => { notificationListeners.delete(listener); };
}

export function pushNotification(notification: Notification) {
  notificationListeners.forEach(fn => fn(notification));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    const { data } = await api.get<{ notifications: Notification[]; unreadCount: number }>('/v2/notifications');
    if (data) {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    await api.put('/v2/notifications/' + id + '/read', {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.put('/v2/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);

    const unsub = onNotification((n) => {
      setNotifications(prev => [n, ...prev]);
      if (!n.read) setUnreadCount(prev => prev + 1);
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [fetchNotifications]);

  return { notifications, unreadCount, markRead, markAllRead, refetch: fetchNotifications };
}

export function NotificationBell({ isOpen, onToggle }: NotificationBellProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <>
      <button
        onClick={onToggle}
        className="relative p-2 rounded-xl hover:bg-brand-sand transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-6 h-6 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brand-primary text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <NotificationPanel
          notifications={notifications}
          onClose={onToggle}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
        />,
        document.body
      )}
    </>
  );
}

const priorityColors: Record<Notification['priority'], string> = {
  low: 'bg-brand-sage/10 border-l-brand-sage',
  medium: 'bg-brand-amber/10 border-l-brand-amber',
  high: 'bg-brand-primary/10 border-l-brand-primary',
  urgent: 'bg-brand-error/10 border-l-brand-error',
};

const typeIcons: Record<Notification['type'], string> = {
  booking: '📅',
  pet_update: '🐾',
  message: '💬',
  reward: '🏆',
  system: '🔔',
};

function NotificationPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const hasUnread = notifications.some(n => !n.read);

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-brand-forest/20 backdrop-blur-sm" />
      <div
        className="absolute top-0 right-0 w-full max-w-sm h-full bg-white shadow-warm-xl animate-slide-down overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-sand">
          <h2 className="font-heading font-semibold text-lg text-brand-forest">Notifications</h2>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-brand-primary font-medium hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-brand-sand transition-colors"
            >
              <svg className="w-5 h-5 text-brand-forest-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-brand-forest-muted">
              <span className="text-4xl mb-3">🔕</span>
              <p className="font-medium">All caught up!</p>
              <p className="text-sm">No notifications right now</p>
            </div>
          ) : (
            <div className="divide-y divide-brand-sand/50">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) onMarkRead(notification.id);
                  }}
                  className={`w-full text-left p-4 transition-colors hover:bg-brand-cream border-l-4 ${
                    priorityColors[notification.priority]
                  } ${!notification.read ? 'bg-brand-warm-white' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{typeIcons[notification.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!notification.read ? 'font-semibold text-brand-forest' : 'font-medium text-brand-forest-light'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-brand-forest-muted mt-0.5 line-clamp-2">{notification.body}</p>
                      {notification.petName && (
                        <span className="inline-block mt-1 text-xs font-pet font-semibold text-brand-sage bg-brand-sage/10 px-2 py-0.5 rounded-full">
                          {notification.petName}
                        </span>
                      )}
                      <p className="text-xs text-brand-forest-muted mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Toast notification for real-time pushes
export function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: Notification | null;
  onDismiss: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (notification) {
      requestAnimationFrame(() => setShow(true));
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [notification, onDismiss]);

  if (!notification) return null;

  return createPortal(
    <div
      className={`fixed top-4 left-4 right-4 z-[10020] transition-all duration-300 max-w-sm mx-auto ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-warm-xl border border-brand-sand p-4 flex items-start gap-3">
        <span className="text-xl">{typeIcons[notification.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-forest">{notification.title}</p>
          <p className="text-sm text-brand-forest-muted mt-0.5 line-clamp-2">{notification.body}</p>
        </div>
        <button onClick={() => { setShow(false); setTimeout(onDismiss, 300); }} className="p-1 text-brand-forest-muted hover:text-brand-forest">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
