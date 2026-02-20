import { useState } from 'react';
import { Button, Badge, Card } from '../../components/ui';
import type { CustomerBooking } from '../../lib/api';

interface CustomerBookingsProps {
  upcomingBookings: CustomerBooking[];
  recentBookings: CustomerBooking[];
}

export function CustomerBookings({ upcomingBookings, recentBookings }: CustomerBookingsProps) {
  const [bookingHistoryPage, setBookingHistoryPage] = useState(1);
  const bookingHistoryLimit = 10;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusVariant = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'confirmed';
      case 'checked_in': return 'checked_in';
      case 'pending': return 'pending';
      case 'checked_out':
      case 'completed': return 'active';
      case 'cancelled': return 'cancelled';
      case 'no_show': return 'closed';
      default: return 'closed';
    }
  };

  const paginatedRecentBookings = recentBookings.slice(0, bookingHistoryPage * bookingHistoryLimit);
  const hasMoreBookingHistory = recentBookings.length > bookingHistoryPage * bookingHistoryLimit;

  return (
    <>
      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <Card title={`Upcoming Bookings (${upcomingBookings.length})`} className="mb-6">
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-gray-100 gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#1B365D]">
                      {formatDate(booking.date)}
                    </span>
                    {booking.start_time && (
                      <span className="text-xs text-gray-500">at {booking.start_time}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{booking.service_display_name || booking.service_name}</p>
                  {booking.dogs.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {booking.dogs.map((d) => d.name).join(', ')}
                    </p>
                  )}
                  {booking.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{booking.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(booking.status)}>
                    {booking.status.replace('_', ' ')}
                  </Badge>
                  {booking.total_cents > 0 && (
                    <span className="text-sm font-medium text-gray-700">
                      ${(booking.total_cents / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Booking History */}
      {recentBookings.length > 0 && (
        <Card
          title="Booking History"
          headerRight={<span className="text-sm text-gray-500">{recentBookings.length} total</span>}
          className="mb-6"
        >
          <div className="space-y-2">
            {paginatedRecentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#1B365D]">
                      {formatDate(booking.date)}
                    </p>
                    <Badge variant={getStatusVariant(booking.status)}>
                      {booking.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{booking.service_display_name || booking.service_name}</p>
                  {booking.dogs.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {booking.dogs.map((d) => d.name).join(', ')}
                    </p>
                  )}
                  {booking.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{booking.notes}</p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  {booking.total_cents > 0 && (
                    <p className="text-sm font-medium text-gray-700">
                      ${(booking.total_cents / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hasMoreBookingHistory && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => setBookingHistoryPage((p) => p + 1)}>
                Load More
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
