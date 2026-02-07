import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ActivityFeed, useActivityFeed } from '../components/ActivityFeed';
import { PetStatusTracker, usePetStatusSSE } from '../components/PetStatusTracker';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface TodayBooking {
  id: string;
  date: string;
  status: string;
  serviceType: {
    displayName: string;
  };
  dogs: Array<{
    dogId: string;
    dog: {
      name: string;
    };
  }>;
}

interface TodayResponse {
  booking: TodayBooking | null;
}

export function ActivityFeedPage() {
  const { customer } = useAuth();
  const navigate = useNavigate();

  const [todayBooking, setTodayBooking] = useState<TodayBooking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);

  const fetchTodayBooking = useCallback(async () => {
    const { data } = await api.get<TodayResponse>('/v2/activities/today');
    if (data) {
      setTodayBooking(data.booking);
    }
    setIsLoadingBooking(false);
  }, []);

  useEffect(() => {
    fetchTodayBooking();
  }, [fetchTodayBooking]);

  const bookingId = todayBooking?.id ?? null;
  const { activities, isLoading: isLoadingActivities } = useActivityFeed(bookingId);
  const petStatuses = usePetStatusSSE(bookingId);

  const dogName = todayBooking?.dogs?.[0]?.dog?.name ?? null;
  const allDogNames = todayBooking?.dogs?.map(d => d.dog.name).join(' & ') ?? '';

  // Loading skeleton
  if (isLoadingBooking) {
    return (
      <AppShell title="Pet Day" showBack>
        <div className="px-4 py-6 space-y-6 animate-pulse">
          <div className="bg-white rounded-3xl p-5 border border-brand-sand/50">
            <div className="h-5 bg-brand-sand rounded w-2/3 mb-3" />
            <div className="h-4 bg-brand-sand rounded w-1/2 mb-2" />
            <div className="h-4 bg-brand-sand rounded w-1/3" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-sand" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-brand-sand rounded w-2/3" />
                  <div className="h-3 bg-brand-sand rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  // No active booking today -- empty state
  if (!todayBooking) {
    return (
      <AppShell title="Pet Day" showBack>
        <div className="px-4 py-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-8 text-center max-w-sm mx-auto w-full">
            {/* Illustration */}
            <div className="w-20 h-20 rounded-full bg-brand-cream mx-auto mb-5 flex items-center justify-center">
              <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            </div>

            <h2 className="font-heading font-semibold text-brand-forest text-lg mb-2">
              No visit today
            </h2>
            <p className="text-sm text-brand-forest-muted mb-6 leading-relaxed">
              {customer?.first_name
                ? `${customer.first_name}, your pup's next adventure is waiting!`
                : "Your pup's next adventure is waiting!"}
            </p>

            <button
              onClick={() => navigate('/book')}
              className="w-full min-h-[44px] bg-gradient-to-r from-brand-primary to-brand-amber text-white font-semibold rounded-2xl px-6 py-3 shadow-warm hover:shadow-warm-lg transition-all duration-200 active:scale-[0.98]"
            >
              Book Your Next Adventure
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Active booking -- show the day feed
  return (
    <AppShell title="Pet Day" showBack>
      <div className="px-4 py-6 space-y-6">

        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-sage to-brand-sage/70 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">
                {dogName?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-pet font-semibold text-brand-forest text-lg truncate">
                {allDogNames ? `${allDogNames}'s Day` : 'Pet Day'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-brand-forest-muted">
                  {todayBooking.serviceType?.displayName ?? 'Visit'}
                </span>
                <span className="w-1 h-1 rounded-full bg-brand-sand" />
                <span className="text-xs text-brand-forest-muted">
                  {new Date(todayBooking.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <StatusBadge status={todayBooking.status} />
          </div>
        </div>

        {/* Pet Status Tracker (progress bar) */}
        {petStatuses.length > 0 && (
          <section>
            <PetStatusTracker statuses={petStatuses} />
          </section>
        )}

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-sage opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-sage" />
          </span>
          <span className="text-xs font-medium text-brand-forest-muted uppercase tracking-wider">
            Live Updates
          </span>
        </div>

        {/* Activity Timeline */}
        <section>
          <ActivityFeed
            activities={activities}
            isLoading={isLoadingActivities}
            dogName={dogName ?? undefined}
          />
        </section>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    checked_in: { bg: 'bg-brand-sage/10', text: 'text-brand-sage', label: 'Checked In' },
    in_service: { bg: 'bg-brand-primary/10', text: 'text-brand-primary', label: 'In Service' },
    confirmed: { bg: 'bg-brand-amber/10', text: 'text-brand-amber', label: 'Confirmed' },
    pending: { bg: 'bg-brand-sand', text: 'text-brand-forest-muted', label: 'Pending' },
    ready: { bg: 'bg-brand-sage/15', text: 'text-brand-sage', label: 'Ready' },
    checked_out: { bg: 'bg-brand-forest-muted/10', text: 'text-brand-forest-muted', label: 'Done' },
  };

  const c = config[status] ?? { bg: 'bg-brand-sand', text: 'text-brand-forest-muted', label: status };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
