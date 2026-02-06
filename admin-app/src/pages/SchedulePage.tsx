import { useState, useEffect, useCallback } from 'react';
import { adminBookingApi, adminGroomingApi } from '../lib/api';
import type { AdminBooking, BookingDog } from '../lib/api';

const STATUS_COLORS: Record<AdminBooking['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmed' },
  checked_in: { bg: 'bg-green-100', text: 'text-green-800', label: 'Checked In' },
  checked_out: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Checked Out' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
  no_show: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'No Show' },
};

const SERVICE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'daycare', label: 'Daycare' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'grooming', label: 'Grooming' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ConditionRater({ bookingDog, onRated }: { bookingDog: BookingDog; onRated: (bd: BookingDog, price: number) => void }) {
  const [rating, setRating] = useState<number>(bookingDog.conditionRating ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotedPrice, setQuotedPrice] = useState<number | null>(bookingDog.quotedPriceCents);

  const handleRate = async (value: number) => {
    setRating(value);
    setIsSubmitting(true);
    const result = await adminGroomingApi.rateCondition(bookingDog.id, value);
    setIsSubmitting(false);
    if (result.data) {
      setQuotedPrice(result.data.priceTier.priceCents);
      onRated(result.data.bookingDog, result.data.priceTier.priceCents);
    }
  };

  return (
    <div className="mt-2 p-3 bg-brand-cream rounded-lg">
      <p className="text-xs font-medium text-brand-navy mb-1.5">
        Coat Condition: {bookingDog.dog.name}
        {bookingDog.dog.sizeCategory && (
          <span className="ml-1 text-gray-500">({bookingDog.dog.sizeCategory})</span>
        )}
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => handleRate(v)}
            disabled={isSubmitting}
            className={`w-9 h-9 rounded-md text-sm font-semibold transition-colors ${
              v <= rating
                ? 'bg-brand-teal text-white'
                : 'bg-white border border-gray-300 text-gray-500 hover:border-brand-teal'
            } ${isSubmitting ? 'opacity-50' : ''}`}
          >
            {v}
          </button>
        ))}
      </div>
      {quotedPrice !== null && (
        <p className="text-sm font-semibold text-brand-teal-dark mt-1.5">
          Price: {formatCents(quotedPrice)}
        </p>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="h-5 bg-gray-200 rounded w-40" />
            <div className="h-5 bg-gray-200 rounded w-20" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-60 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

export function SchedulePage() {
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [filter, setFilter] = useState('');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await adminBookingApi.getSchedule(date, filter || undefined);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      setBookings([]);
    } else if (result.data) {
      setBookings(result.data.bookings);
    }
  }, [date, filter]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const navigateDate = (direction: -1 | 1) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + direction);
    setDate(toDateString(d));
  };

  const goToToday = () => {
    setDate(toDateString(new Date()));
  };

  const handleAction = async (
    bookingId: string,
    action: 'confirm' | 'checkIn' | 'checkOut' | 'noShow',
  ) => {
    const apiMap = {
      confirm: adminBookingApi.confirmBooking,
      checkIn: adminBookingApi.checkIn,
      checkOut: adminBookingApi.checkOut,
      noShow: adminBookingApi.markNoShow,
    };
    const result = await apiMap[action](bookingId);
    if (result.data) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? result.data!.booking : b)),
      );
    }
  };

  const handleConditionRated = (bookingId: string, updatedDog: BookingDog) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          dogs: b.dogs.map((d) => (d.id === updatedDog.id ? updatedDog : d)),
        };
      }),
    );
  };

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const isToday = date === toDateString(new Date());

  return (
    <div className="max-w-5xl mx-auto">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-white shadow hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="font-heading text-xl font-bold text-brand-navy">
            {formatDate(date)}
          </h1>
          {!isToday && (
            <button
              onClick={goToToday}
              className="text-sm text-brand-teal hover:text-brand-teal-dark font-medium mt-0.5"
            >
              Back to Today
            </button>
          )}
        </div>

        <button
          onClick={() => navigateDate(1)}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-white shadow hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Summary Bar */}
      {!isLoading && bookings.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(['pending', 'confirmed', 'checked_in'] as const).map((s) => {
            const count = statusCounts[s] || 0;
            if (count === 0) return null;
            const color = STATUS_COLORS[s];
            return (
              <span key={s} className={`px-3 py-1 rounded-full text-sm font-medium ${color.bg} ${color.text}`}>
                {count} {color.label}
              </span>
            );
          })}
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
            {bookings.length} Total
          </span>
        </div>
      )}

      {/* Service Filter Tabs */}
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 mb-6">
        {SERVICE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
              filter === f.value
                ? 'bg-brand-navy text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <button
            onClick={fetchSchedule}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No bookings for this day</p>
          <p className="text-gray-400 text-sm mt-1">
            {filter ? `No ${filter} bookings found` : 'Check another date or service type'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const statusStyle = STATUS_COLORS[booking.status];
            const isGrooming = booking.serviceType.name === 'grooming';
            const dogNames = booking.dogs.map((d) => d.dog.name).join(', ');

            return (
              <div key={booking.id} className="bg-white rounded-lg shadow p-4">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-brand-navy">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {dogNames}
                      {booking.dogs.length > 1 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({booking.dogs.length} dogs)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>

                {/* Info Row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-brand-cream text-brand-navy text-xs font-medium">
                    {booking.serviceType.displayName}
                  </span>
                  {booking.startTime && (
                    <span className="text-sm text-gray-500">
                      {booking.startTime}
                    </span>
                  )}
                  {booking.totalCents > 0 && (
                    <span className="text-sm font-medium text-gray-700">
                      {formatCents(booking.totalCents)}
                    </span>
                  )}
                </div>

                {/* Grooming Condition Rating (when checked in) */}
                {isGrooming && booking.status === 'checked_in' && booking.dogs.map((dog) => (
                  <ConditionRater
                    key={dog.id}
                    bookingDog={dog}
                    onRated={(updatedDog) => handleConditionRated(booking.id, updatedDog)}
                  />
                ))}

                {/* Notes */}
                {booking.notes && (
                  <p className="text-sm text-gray-500 italic mt-2 mb-3">
                    {booking.notes}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(booking.id, 'confirm')}
                        className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleAction(booking.id, 'noShow')}
                        className="min-h-[44px] px-4 py-2.5 bg-white border border-orange-300 text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors"
                      >
                        No-Show
                      </button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleAction(booking.id, 'checkIn')}
                        className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                      >
                        Check In
                      </button>
                      <button
                        onClick={() => handleAction(booking.id, 'noShow')}
                        className="min-h-[44px] px-4 py-2.5 bg-white border border-orange-300 text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors"
                      >
                        No-Show
                      </button>
                    </>
                  )}
                  {booking.status === 'checked_in' && (
                    <button
                      onClick={() => handleAction(booking.id, 'checkOut')}
                      className="flex-1 min-h-[44px] px-4 py-2.5 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-navy/90 transition-colors"
                    >
                      Check Out
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
