import { useNotification } from '../../contexts/NotificationContext';
import type { NotificationType } from '../../contexts/NotificationContext';

const TYPE_STYLES: Record<NotificationType, { bg: string; border: string; icon: string; iconBg: string }> = {
  success: {
    bg: 'bg-white',
    border: 'border-[#7FB685]',
    icon: 'text-[#7FB685]',
    iconBg: 'bg-[#7FB685]/10',
  },
  info: {
    bg: 'bg-white',
    border: 'border-[#62A2C3]',
    icon: 'text-[#62A2C3]',
    iconBg: 'bg-[#62A2C3]/10',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-[#F5C65D]',
    icon: 'text-[#F5C65D]',
    iconBg: 'bg-[#F5C65D]/10',
  },
  error: {
    bg: 'bg-white',
    border: 'border-[#E8837B]',
    icon: 'text-[#E8837B]',
    iconBg: 'bg-[#E8837B]/10',
  },
};

function TypeIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case 'success':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'info':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

export function NotificationToast() {
  const { notifications, dismiss } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => {
        const style = TYPE_STYLES[notif.type];
        return (
          <div
            key={notif.id}
            className={`${style.bg} border-l-4 ${style.border} rounded-lg shadow-lg p-3 flex items-start gap-3 pointer-events-auto animate-slide-in-right`}
          >
            <div className={`w-8 h-8 rounded-full ${style.iconBg} ${style.icon} flex items-center justify-center flex-shrink-0`}>
              <TypeIcon type={notif.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1B365D]">{notif.title}</p>
              {notif.message && (
                <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(notif.id)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
