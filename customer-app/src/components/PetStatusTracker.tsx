import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface PetStatus {
  bookingId: string;
  dogId: string;
  dogName: string;
  status: 'booked' | 'checked_in' | 'in_service' | 'ready' | 'picked_up';
  updatedAt: string;
  serviceName?: string;
  staffNote?: string;
}

const STATUS_STEPS = [
  { key: 'booked', label: 'Booked', icon: '📅' },
  { key: 'checked_in', label: 'Checked In', icon: '✅' },
  { key: 'in_service', label: 'In Service', icon: '✨' },
  { key: 'ready', label: 'Ready', icon: '🎉' },
  { key: 'picked_up', label: 'Picked Up', icon: '🏠' },
] as const;

function getStepIndex(status: PetStatus['status']): number {
  return STATUS_STEPS.findIndex(s => s.key === status);
}

export function usePetStatusSSE(bookingId: string | null) {
  const [statuses, setStatuses] = useState<PetStatus[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const token = localStorage.getItem('token');
    const url = `${API_BASE}/v2/bookings/${bookingId}/status-stream?token=${encodeURIComponent(token || '')}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setStatuses(data);
        } else {
          setStatuses(prev => {
            const idx = prev.findIndex(s => s.dogId === data.dogId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = data;
              return next;
            }
            return [...prev, data];
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5s
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
      }, 5000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [bookingId]);

  return statuses;
}

export function PetStatusTracker({ statuses }: { statuses: PetStatus[] }) {
  if (statuses.length === 0) return null;

  return (
    <div className="space-y-4">
      {statuses.map((status) => (
        <PetStatusCard key={`${status.bookingId}-${status.dogId}`} status={status} />
      ))}
    </div>
  );
}

function PetStatusCard({ status }: { status: PetStatus }) {
  const currentStep = getStepIndex(status.status);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-warm border border-brand-sand/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand-sage/10 flex items-center justify-center">
          <span className="text-lg">🐾</span>
        </div>
        <div>
          <h3 className="font-pet font-semibold text-brand-forest text-base">{status.dogName}</h3>
          {status.serviceName && (
            <p className="text-xs text-brand-forest-muted">{status.serviceName}</p>
          )}
        </div>
        <div className="ml-auto">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            status.status === 'ready'
              ? 'bg-brand-success/10 text-brand-success'
              : status.status === 'in_service'
              ? 'bg-brand-primary/10 text-brand-primary'
              : status.status === 'picked_up'
              ? 'bg-brand-forest-muted/10 text-brand-forest-muted'
              : 'bg-brand-amber/10 text-brand-amber-dark'
          }`}>
            {STATUS_STEPS[currentStep]?.icon} {STATUS_STEPS[currentStep]?.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          {STATUS_STEPS.map((step, idx) => {
            const isComplete = idx <= currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center z-10" style={{ width: '20%' }}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${
                    isCurrent
                      ? 'bg-brand-primary text-white shadow-glow scale-110'
                      : isComplete
                      ? 'bg-brand-sage text-white'
                      : 'bg-brand-sand text-brand-forest-muted'
                  }`}
                >
                  {step.icon}
                </div>
                <span className={`text-[10px] mt-1 text-center leading-tight ${
                  isCurrent ? 'font-semibold text-brand-primary' : 'text-brand-forest-muted'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Track line */}
        <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-brand-sand -z-0">
          <div
            className="h-full bg-brand-sage transition-all duration-700 ease-out rounded-full"
            style={{ width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {status.staffNote && (
        <div className="mt-3 p-3 bg-brand-cream rounded-xl">
          <p className="text-xs text-brand-forest-muted italic">"{status.staffNote}"</p>
        </div>
      )}
    </div>
  );
}
