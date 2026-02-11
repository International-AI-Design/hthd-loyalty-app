import { Router } from 'express';
import { authenticateCustomer } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

const router = Router();

// All routes require customer auth
router.use(authenticateCustomer);

// GET /api/v2/notifications - List customer notifications
router.get('/', async (req, res) => {
  try {
    const customerId = (req as any).customer.id;

    // For now, build notifications from existing data (bookings, messages, etc.)
    // In the future this would be a dedicated Notification table
    const [bookings, conversations] = await Promise.all([
      prisma.booking.findMany({
        where: {
          customerId,
          status: { in: ['confirmed', 'checked_in', 'checked_out'] },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { serviceType: true, dogs: { include: { dog: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.conversation.findMany({
        where: { customerId, status: 'active' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
      }),
    ]);

    const notifications: any[] = [];

    // Booking notifications
    for (const booking of bookings) {
      const dogNames = booking.dogs.map((bd: any) => bd.dog.name).join(', ');
      if (booking.status === 'confirmed') {
        notifications.push({
          id: `booking-confirmed-${booking.id}`,
          type: 'booking',
          title: 'Booking Confirmed',
          body: `Your ${booking.serviceType.displayName} for ${dogNames} on ${booking.date} is confirmed`,
          priority: 'medium',
          read: true,
          createdAt: booking.createdAt,
          petName: dogNames,
        });
      }
      if (booking.status === 'checked_in') {
        notifications.push({
          id: `booking-checkin-${booking.id}`,
          type: 'pet_update',
          title: `${dogNames} Checked In`,
          body: `${dogNames} has been checked in for ${booking.serviceType.displayName}`,
          priority: 'high',
          read: false,
          createdAt: booking.updatedAt || booking.createdAt,
          petName: dogNames,
        });
      }
    }

    // Message notifications
    for (const convo of conversations) {
      const lastMsg = convo.messages[0];
      if (lastMsg && lastMsg.role !== 'customer') {
        notifications.push({
          id: `msg-${lastMsg.id}`,
          type: 'message',
          title: lastMsg.role === 'staff' ? 'Staff Reply' : 'New Message',
          body: lastMsg.content.substring(0, 100) + (lastMsg.content.length > 100 ? '...' : ''),
          priority: lastMsg.role === 'staff' ? 'high' : 'low',
          read: !!(lastMsg as any).readAt,
          createdAt: lastMsg.createdAt,
        });
      }
    }

    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// PUT /api/v2/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  res.json({ success: true });
});

// PUT /api/v2/notifications/read-all
router.put('/read-all', async (req, res) => {
  res.json({ success: true });
});

export default router;
