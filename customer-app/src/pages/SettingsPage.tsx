import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { customerApi } from '../lib/api';

const APP_VERSION = '1.0.0';

function formatMemberSince(dateStr?: string | null): string {
  if (!dateStr) return 'Member';
  const d = new Date(dateStr);
  return `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

function getLoyaltyTier(points: number): string {
  if (points >= 500) return 'Gold';
  if (points >= 250) return 'Silver';
  if (points >= 100) return 'Bronze';
  return 'New';
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'Gold': return 'bg-brand-amber/15 text-brand-amber-dark';
    case 'Silver': return 'bg-brand-sand text-brand-forest-light';
    case 'Bronze': return 'bg-brand-primary/10 text-brand-primary-dark';
    default: return 'bg-brand-sage/10 text-brand-sage-dark';
  }
}

export function SettingsPage() {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();

  const [petCount, setPetCount] = useState<number | null>(null);

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

  useEffect(() => {
    customerApi.getDogs().then(({ data }) => {
      if (data) setPetCount(data.dogs.length);
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tier = getLoyaltyTier(customer?.points_balance ?? 0);
  const tierColor = getTierColor(tier);

  return (
    <AppShell title="Profile & Settings" showBack>
      <div className="px-4 py-6 space-y-5">

        {/* Profile Hero */}
        <section className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-primary-dark flex items-center justify-center flex-shrink-0 shadow-warm">
                <span className="text-white font-heading font-bold text-2xl">
                  {customer?.first_name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-semibold text-brand-forest text-xl truncate">
                  {customer?.first_name} {customer?.last_name}
                </h2>
                <p className="text-sm text-brand-forest-muted">
                  {formatMemberSince((customer as any)?.created_at)}
                </p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1.5 ${tierColor}`}>
                  {tier} Member
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-brand-sand/40">
              <ProfileField label="Email" value={customer?.email ?? '--'} />
              <ProfileField label="Phone" value={customer?.phone ?? '--'} />
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/my-pets')}
            className="bg-white rounded-2xl shadow-warm-sm border border-brand-sand/50 p-4 text-center active:scale-95 transition-transform"
          >
            <p className="text-2xl font-heading font-bold text-brand-forest">
              {petCount !== null ? petCount : '--'}
            </p>
            <p className="text-xs text-brand-forest-muted mt-0.5">
              {petCount === 1 ? 'Pet' : 'Pets'}
            </p>
          </button>
          <button
            onClick={() => navigate('/rewards')}
            className="bg-white rounded-2xl shadow-warm-sm border border-brand-sand/50 p-4 text-center active:scale-95 transition-transform"
          >
            <p className="text-2xl font-heading font-bold text-brand-primary">
              {customer?.points_balance?.toLocaleString() ?? '0'}
            </p>
            <p className="text-xs text-brand-forest-muted mt-0.5">Points</p>
          </button>
          <button
            onClick={() => navigate('/bookings')}
            className="bg-white rounded-2xl shadow-warm-sm border border-brand-sand/50 p-4 text-center active:scale-95 transition-transform"
          >
            <p className="text-2xl font-heading font-bold text-brand-sage-dark">
              {tier}
            </p>
            <p className="text-xs text-brand-forest-muted mt-0.5">Tier</p>
          </button>
        </section>

        {/* Quick Links */}
        <section className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
          <div className="p-5 space-y-1">
            <h3 className="font-heading font-semibold text-brand-forest text-base mb-3">Quick Links</h3>

            <LinkRow
              label="My Pets"
              icon={<span className="text-base">🐾</span>}
              onClick={() => navigate('/my-pets')}
            />
            <div className="border-t border-brand-sand/40" />
            <LinkRow
              label="Rewards & Points"
              icon={<span className="text-base">🏆</span>}
              onClick={() => navigate('/rewards')}
            />
            <div className="border-t border-brand-sand/40" />
            <LinkRow
              label="Booking History"
              icon={<span className="text-base">📅</span>}
              onClick={() => navigate('/bookings')}
            />
            <div className="border-t border-brand-sand/40" />
            <LinkRow
              label="Report Cards"
              icon={<span className="text-base">📋</span>}
              onClick={() => navigate('/report-cards')}
            />
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

function LinkRow({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-between py-3 min-h-[44px] text-left"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-brand-forest">{label}</span>
      </div>
      <svg className="w-5 h-5 text-brand-forest-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
