import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface ActivityEvent {
  id: string;
  bookingId: string;
  dogId: string;
  dogName: string;
  type: 'check_in' | 'play' | 'meal' | 'nap' | 'grooming' | 'photo' | 'note' | 'check_out' | 'medication';
  title: string;
  description?: string;
  photoUrl?: string;
  staffName?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const activityIcons: Record<ActivityEvent['type'], string> = {
  check_in: '✅',
  play: '🎾',
  meal: '🍖',
  nap: '😴',
  grooming: '✂️',
  photo: '📸',
  note: '📝',
  check_out: '🏠',
  medication: '💊',
};

const activityColors: Record<ActivityEvent['type'], string> = {
  check_in: 'bg-brand-sage/10 border-brand-sage',
  play: 'bg-brand-amber/10 border-brand-amber',
  meal: 'bg-brand-primary/10 border-brand-primary',
  nap: 'bg-purple-50 border-purple-300',
  grooming: 'bg-brand-sage/10 border-brand-sage',
  photo: 'bg-blue-50 border-blue-300',
  note: 'bg-brand-sand border-brand-forest-muted',
  check_out: 'bg-brand-success/10 border-brand-success',
  medication: 'bg-red-50 border-red-300',
};

export function useActivityFeed(bookingId: string | null) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!bookingId) return;
    setIsLoading(true);
    const { data } = await api.get<{ activities: ActivityEvent[] }>(`/v2/bookings/${bookingId}/activities`);
    if (data) {
      setActivities(data.activities);
    }
    setIsLoading(false);
  }, [bookingId]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30_000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return { activities, isLoading, refetch: fetchActivities };
}

export function ActivityFeed({
  activities,
  isLoading,
  dogName,
}: {
  activities: ActivityEvent[];
  isLoading: boolean;
  dogName?: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
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
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">🐾</span>
        <p className="font-medium text-brand-forest">No activity yet</p>
        <p className="text-sm text-brand-forest-muted mt-1">
          {dogName ? `${dogName}'s` : "Your pet's"} day will show up here
        </p>
      </div>
    );
  }

  // Group by date
  const grouped = activities.reduce<Record<string, ActivityEvent[]>>((acc, activity) => {
    const dateKey = new Date(activity.timestamp).toLocaleDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(activity);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, events]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-brand-sand" />
            <span className="text-xs font-semibold text-brand-forest-muted uppercase tracking-wider">{date}</span>
            <div className="h-px flex-1 bg-brand-sand" />
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-brand-sand" />

            <div className="space-y-4">
              {events.map((event, idx) => (
                <ActivityCard key={event.id} event={event} isLast={idx === events.length - 1} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`relative flex gap-3 pl-0 ${isLast ? '' : 'pb-1'}`}>
      {/* Timeline dot */}
      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${activityColors[event.type]}`}>
        <span className="text-base">{activityIcons[event.type]}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl p-4 shadow-warm-sm border border-brand-sand/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-brand-forest">{event.title}</p>
            {event.description && (
              <p className="text-sm text-brand-forest-muted mt-1">{event.description}</p>
            )}
          </div>
          <span className="text-xs text-brand-forest-muted whitespace-nowrap flex-shrink-0">{time}</span>
        </div>

        {event.photoUrl && (
          <div className="mt-3 rounded-xl overflow-hidden bg-brand-sand">
            <img
              src={event.photoUrl}
              alt={`${event.dogName} - ${event.title}`}
              className={`w-full h-48 object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
            />
            {!imageLoaded && (
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-2xl animate-pulse">📸</span>
              </div>
            )}
          </div>
        )}

        {event.staffName && (
          <p className="text-xs text-brand-forest-muted mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            {event.staffName}
          </p>
        )}
      </div>
    </div>
  );
}
