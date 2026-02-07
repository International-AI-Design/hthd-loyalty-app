import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';

const APP_VERSION = '1.0.0';

export function SettingsPage() {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('hthd_notifications') !== 'false';
  });

  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    localStorage.setItem('hthd_notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hthd_dark_mode', String(darkMode));
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell title="Settings" showBack>
      <div className="px-4 py-6 space-y-6">

        {/* Profile Section */}
        <section className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-amber flex items-center justify-center flex-shrink-0">
                <span className="text-white font-heading font-bold text-xl">
                  {customer?.first_name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-heading font-semibold text-brand-forest text-lg truncate">
                  {customer?.first_name} {customer?.last_name}
                </h2>
                <p className="text-sm text-brand-forest-muted">Member</p>
              </div>
            </div>

            <div className="space-y-4">
              <ProfileField label="Name" value={`${customer?.first_name ?? ''} ${customer?.last_name ?? ''}`} />
              <ProfileField label="Email" value={customer?.email ?? '--'} />
              <ProfileField label="Phone" value={customer?.phone ?? '--'} />
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
          <div className="p-5 space-y-1">
            <h3 className="font-heading font-semibold text-brand-forest text-base mb-4">Preferences</h3>

            {/* Notifications Toggle */}
            <ToggleRow
              label="Push Notifications"
              description="Activity updates, promotions & reminders"
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
            />

            <div className="border-t border-brand-sand/40" />

            {/* Dark Mode Toggle */}
            <ToggleRow
              label="Dark Mode"
              description="Switch to a darker color scheme"
              checked={darkMode}
              onChange={setDarkMode}
            />
          </div>
        </section>

        {/* Legal Section */}
        <section className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
          <div className="p-5 space-y-1">
            <h3 className="font-heading font-semibold text-brand-forest text-base mb-4">Legal</h3>

            <LinkRow label="Privacy Policy" onClick={() => navigate('/privacy')} />
            <div className="border-t border-brand-sand/40" />
            <LinkRow label="Terms of Service" onClick={() => navigate('/terms')} />
          </div>
        </section>

        {/* Logout */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:text-white"
            onClick={handleLogout}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </Button>
        </div>

        {/* App Version */}
        <div className="text-center pb-4">
          <p className="text-xs text-brand-forest-muted">
            Happy Tail Happy Dog v{APP_VERSION}
          </p>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-brand-forest-muted">{label}</span>
      <span className="text-sm font-medium text-brand-forest text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-between py-3 min-h-[44px] text-left"
      onClick={() => onChange(!checked)}
    >
      <div className="pr-4">
        <p className="text-sm font-medium text-brand-forest">{label}</p>
        <p className="text-xs text-brand-forest-muted mt-0.5">{description}</p>
      </div>
      <div
        className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${
          checked ? 'bg-brand-sage' : 'bg-brand-sand'
        }`}
      >
        <div
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-warm-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-between py-3 min-h-[44px] text-left"
      onClick={onClick}
    >
      <span className="text-sm font-medium text-brand-forest">{label}</span>
      <svg className="w-5 h-5 text-brand-forest-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
