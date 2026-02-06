import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../lib/api';
import type { Booking } from '../lib/api';
import { Button, Modal } from '../components/ui';

type Tab = 'upcoming' | 'past';

export function BookingsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true);
  const [isLoadingPast, setIsLoadingPast] = useState(true);

  // Cancel state
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchUpcoming = useCallback(async () => {
    setIsLoadingUpcoming(true);
    const [pendingRes, confirmedRes] = await Promise.all([
      bookingApi.getBookings({ status: 'pending', limit: 50 }),
      bookingApi.getBookings({ status: 'confirmed', limit: 50 }),
    ]);
    const pending = pendingRes.data?.bookings || [];
    const confirmed = confirmedRes.data?.bookings || [];
    const combined = [...pending, ...confirmed].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setUpcomingBookings(combined);
    setIsLoadingUpcoming(false);
  }, []);

  const fetchPast = useCallback(async () => {
    setIsLoadingPast(true);
    const [completedRes, cancelledRes, noShowRes] = await Promise.all([
      bookingApi.getBookings({ status: 'checked_out', limit: 50 }),
      bookingApi.getBookings({ status: 'cancelled', limit: 50 }),
      bookingApi.getBookings({ status: 'no_show', limit: 50 }),
    ]);
    const completed = completedRes.data?.bookings || [];
    const cancelled = cancelledRes.data?.bookings || [];
    const noShow = noShowRes.data?.bookings || [];
    const combined = [...completed, ...cancelled, ...noShow].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setPastBookings(combined);
    setIsLoadingPast(false);
  }, []);

  useEffect(() => {
    fetchUpcoming();
    fetchPast();
  }, [fetchUpcoming, fetchPast]);

  const handleCancel = async () => {
    if (!cancelBookingId) return;
    setIsCancelling(true);
    setCancelError(null);
    const { error } = await bookingApi.cancelBooking(cancelBookingId);
    if (error) {
      setCancelError(error);
      setIsCancelling(false);
      return;
    }
    setCancelBookingId(null);
    setIsCancelling(false);
    fetchUpcoming();
    fetchPast();
  };

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status: Booking['status']) => {
    const styles: Record<Booking['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      checked_in: 'bg-blue-100 text-blue-800',
      checked_out: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-red-100 text-red-800',
    };
    const labels: Record<Booking['status'], string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      checked_in: 'Checked In',
      checked_out: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const renderBookingCard = (booking: Booking, showCancel: boolean) => (
    <div key={booking.id} className="bg-white rounded-2xl shadow-md p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-brand-navy">{booking.serviceType.displayName}</h3>
          <p className="text-sm text-gray-600">{formatDate(booking.date)}</p>
          {booking.startTime && (
            <p className="text-sm text-gray-500">{formatTime(booking.startTime)}</p>
          )}
        </div>
        {getStatusBadge(booking.status)}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {booking.dogs.map((bd) => (
          <span
            key={bd.id}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cream text-sm text-brand-navy"
          >
            <span className="w-5 h-5 bg-brand-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
              {bd.dog.name.charAt(0).toUpperCase()}
            </span>
            {bd.dog.name}
          </span>
        ))}
      </div>

      {showCancel && (booking.status === 'pending' || booking.status === 'confirmed') && (
        <button
          onClick={() => {
            setCancelError(null);
            setCancelBookingId(booking.id);
          }}
          className="text-sm text-brand-coral hover:text-red-600 font-medium transition-colors min-h-[44px] flex items-center"
        >
          Cancel Booking
        </button>
      )}
    </div>
  );

  const renderEmptyState = (tab: Tab) => (
    <div className="text-center py-16">
      <svg
        className="mx-auto h-16 w-16 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="mt-4 text-gray-500 font-medium">
        {tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
      </p>
      {tab === 'upcoming' && (
        <Button className="mt-4" onClick={() => navigate('/book')}>
          Book an Appointment
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex items-center justify-center gap-3">
              <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
              <h1 className="font-heading text-lg font-bold text-brand-navy">My Bookings</h1>
            </div>
            <div className="w-11" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl shadow-sm p-1 mb-6">
          {(['upcoming', 'past'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-colors min-h-[44px] capitalize ${
                activeTab === tab
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'text-gray-600 hover:text-brand-navy'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {isLoadingUpcoming ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : upcomingBookings.length === 0 ? (
              renderEmptyState('upcoming')
            ) : (
              upcomingBookings.map((b) => renderBookingCard(b, true))
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div className="space-y-4">
            {isLoadingPast ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-teal" />
              </div>
            ) : pastBookings.length === 0 ? (
              renderEmptyState('past')
            ) : (
              pastBookings.map((b) => renderBookingCard(b, false))
            )}
          </div>
        )}
      </main>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        title="Cancel Booking"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to cancel this booking? This action cannot be undone.
          </p>
          {cancelError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {cancelError}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCancelBookingId(null)}
              disabled={isCancelling}
            >
              Keep Booking
            </Button>
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 py-2 px-4 rounded-lg bg-brand-coral text-white font-semibold hover:bg-red-500 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
