import { Router } from 'express';
import { authenticateCustomer } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(authenticateCustomer);

// GET /api/v2/activities/today - Get today's activities for customer's dogs
router.get('/today', async (req, res) => {
  try {
    const customerId = (req as any).customer.id;
    const today = new Date().toISOString().split('T')[0];

    // Find today's active bookings for this customer
    const bookings = await prisma.booking.findMany({
      where: {
        customerId,
        date: today,
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        dogs: { include: { dog: true } },
        serviceType: true,
        reportCards: true,
      },
    });

    // Build activity events from booking data
    const activities: any[] = [];

    for (const booking of bookings) {
      for (const bd of booking.dogs) {
        const dogName = bd.dog.name;

        // Check-in event
        if (booking.status === 'checked_in') {
          activities.push({
            id: `checkin-${booking.id}-${bd.dogId}`,
            bookingId: booking.id,
            dogId: bd.dogId,
            dogName,
            type: 'check_in',
            title: `${dogName} checked in`,
            description: `Arrived for ${booking.serviceType.displayName}`,
            timestamp: booking.updatedAt || booking.createdAt,
          });
        }

        // Report card entries as activities
        for (const rc of booking.reportCards) {
          if ((rc as any).mood) {
            activities.push({
              id: `mood-${rc.id}`,
              bookingId: booking.id,
              dogId: bd.dogId,
              dogName,
              type: 'note',
              title: `${dogName} mood update`,
              description: `Mood: ${(rc as any).mood} - ${(rc as any).summary || ''}`,
              timestamp: rc.createdAt,
              staffName: 'Staff',
            });
          }
          if ((rc as any).photoUrl) {
            activities.push({
              id: `photo-${rc.id}`,
              bookingId: booking.id,
              dogId: bd.dogId,
              dogName,
              type: 'photo',
              title: `New photo of ${dogName}`,
              photoUrl: (rc as any).photoUrl,
              timestamp: rc.createdAt,
              staffName: 'Staff',
            });
          }
        }
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ activities, bookings: bookings.map(b => ({ id: b.id, date: b.date, status: b.status })) });
  } catch (error) {
    console.error('Failed to get today activities:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

export default router;
