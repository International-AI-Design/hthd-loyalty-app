import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NotificationBell } from './NotificationCenter';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  hideNav?: boolean;
  headerRight?: React.ReactNode;
}

export function AppShell({ children, title, showBack, hideNav, headerRight }: AppShellProps) {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-brand-cream flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-brand-sand/50">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-xl hover:bg-brand-sand transition-colors"
              >
                <svg className="w-5 h-5 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            {title ? (
              <h1 className="text-lg font-heading font-semibold text-brand-forest">{title}</h1>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl">🐾</span>
                <span className="font-heading font-semibold text-brand-forest text-lg">Happy Tail</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            <NotificationBell
              isOpen={notificationsOpen}
              onToggle={() => setNotificationsOpen(!notificationsOpen)}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full pb-20">
        {children}
      </main>

      {/* Bottom Tab Navigation */}
      {!hideNav && <BottomNav />}
    </div>
  );
}
