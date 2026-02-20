import Anthropic from '@anthropic-ai/sdk';
import { DashboardService } from '../dashboard/service';
import { BookingService } from '../booking/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const dashboardService = new DashboardService();
const bookingService = new BookingService();

export const AIM_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_today_summary',
    description:
      "Get today's full facility overview: dogs on-site, arrivals/departures, staff, and compliance flags.",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description:
            'Date in YYYY-MM-DD format. Defaults to today if not provided.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_customer',
    description:
      'Search customers by name, phone number, or email. Returns matching customer records with their dogs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Search term — customer name, phone number, or email address.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_dog',
    description:
      'Search dogs by name. Returns matching dogs with their owner information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Dog name to search for.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'check_schedule',
    description:
      'View bookings for a date or date range. Optionally filter by service type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        end_date: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format. Same as start_date for a single day.',
        },
        service_type: {
          type: 'string',
          description: 'Optional service filter.',
          enum: ['daycare', 'boarding', 'grooming'],
        },
      },
      required: ['start_date'],
    },
  },
  {
    name: 'get_staff_schedule',
    description:
      'View staff schedules for a specific date. Shows who is working and their shifts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format.',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'create_booking',
    description:
      'Create a booking for a customer. Always check availability first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'Customer UUID.',
        },
        service_type: {
          type: 'string',
          description: 'Service type.',
          enum: ['daycare', 'boarding', 'grooming'],
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        end_date: {
          type: 'string',
          description:
            'End date in YYYY-MM-DD format. Same as start_date for single-day.',
        },
        dog_ids: {
          type: 'array',
          description: 'Array of dog UUIDs to book.',
          items: { type: 'string' },
        },
        notes: {
          type: 'string',
          description: 'Optional booking notes.',
        },
      },
      required: ['customer_id', 'service_type', 'start_date', 'dog_ids'],
    },
  },
  {
    name: 'check_compliance',
    description:
      'Check vaccination and compliance status for dogs with upcoming bookings.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_revenue_summary',
    description: 'Get basic revenue stats — total payments and points transactions for a date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
];

function todayStr(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}

export async function executeAimTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  logger.info(`AIM executing tool: ${toolName}`, { input: toolInput });

  switch (toolName) {
    case 'get_today_summary': {
      const date = (toolInput.date as string) || todayStr();
      return dashboardService.getDashboardSummary(date);
    }

    case 'search_customer': {
      const query = toolInput.query as string;
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
          ],
        },
        include: {
          dogs: {
            select: {
              id: true,
              name: true,
              breed: true,
              sizeCategory: true,
            },
          },
        },
        take: 10,
      });

      return {
        count: customers.length,
        customers: customers.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          pointsBalance: c.pointsBalance,
          accountStatus: c.accountStatus,
          dogs: c.dogs,
        })),
      };
    }

    case 'search_dog': {
      const name = toolInput.name as string;
      const dogs = await prisma.dog.findMany({
        where: {
          name: { contains: name, mode: 'insensitive' },
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
        take: 10,
      });

      return {
        count: dogs.length,
        dogs: dogs.map((d) => ({
          id: d.id,
          name: d.name,
          breed: d.breed,
          sizeCategory: d.sizeCategory,
          weight: d.weight,
          temperament: d.temperament,
          owner: {
            id: d.customer.id,
            name: `${d.customer.firstName} ${d.customer.lastName}`,
            phone: d.customer.phone,
          },
        })),
      };
    }

    case 'check_schedule': {
      const startDate = toolInput.start_date as string;
      const endDate = (toolInput.end_date as string) || startDate;
      const serviceType = toolInput.service_type as string | undefined;

      // Resolve service type ID if provided
      let serviceTypeId: string | undefined;
      if (serviceType) {
        const svc = await (prisma as any).serviceType.findUnique({
          where: { name: serviceType },
        });
        serviceTypeId = svc?.id;
      }

      const bookings = await bookingService.getScheduleRange(
        new Date(startDate + 'T00:00:00Z'),
        new Date(endDate + 'T00:00:00Z'),
        serviceTypeId
      );

      return {
        dateRange: `${startDate} to ${endDate}`,
        total: bookings.length,
        bookings: bookings.map((b: any) => ({
          id: b.id,
          customer: `${b.customer.firstName} ${b.customer.lastName}`,
          service: b.serviceType.name,
          date: b.date
            ? new Date(b.date).toISOString().split('T')[0]
            : undefined,
          startDate: b.startDate
            ? new Date(b.startDate).toISOString().split('T')[0]
            : undefined,
          endDate: b.endDate
            ? new Date(b.endDate).toISOString().split('T')[0]
            : undefined,
          startTime: b.startTime,
          status: b.status,
          dogs: b.dogs.map((bd: any) => bd.dog.name),
          totalPrice: `$${(b.totalCents / 100).toFixed(2)}`,
        })),
      };
    }

    case 'get_staff_schedule': {
      const date = toolInput.date as string;
      const dateObj = new Date(date + 'T00:00:00Z');

      const schedules = await (prisma as any).staffSchedule.findMany({
        where: { date: dateObj },
        include: {
          staffUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          breaks: true,
        },
        orderBy: { startTime: 'asc' },
      });

      return {
        date,
        count: schedules.length,
        staff: schedules.map((s: any) => ({
          id: s.staffUser.id,
          name: `${s.staffUser.firstName} ${s.staffUser.lastName}`,
          role: s.role,
          startTime: s.startTime,
          endTime: s.endTime,
          notes: s.notes,
          breaks: s.breaks?.map((b: any) => ({
            type: b.type,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        })),
      };
    }

    case 'create_booking': {
      const customerId = toolInput.customer_id as string;
      const serviceType = toolInput.service_type as string;
      const startDate = toolInput.start_date as string;
      const endDate = (toolInput.end_date as string) || startDate;
      const dogIds = toolInput.dog_ids as string[];
      const notes = toolInput.notes as string | undefined;

      // Resolve service type
      const svc = await (prisma as any).serviceType.findUnique({
        where: { name: serviceType },
      });
      if (!svc) {
        return { error: `Unknown service type: ${serviceType}` };
      }

      try {
        const isMultiDay = startDate !== endDate;
        let booking: any;

        if (isMultiDay) {
          booking = await bookingService.createMultiDayBooking({
            customerId,
            serviceTypeId: svc.id,
            startDate,
            endDate,
            dogIds,
            notes,
          });
        } else {
          booking = await bookingService.createBooking({
            customerId,
            serviceTypeId: svc.id,
            date: startDate,
            dogIds,
            notes,
          });
        }

        return {
          success: true,
          bookingId: booking.id,
          service: serviceType,
          date: isMultiDay ? `${startDate} to ${endDate}` : startDate,
          dogs: booking.dogs.map((bd: any) => bd.dog.name),
          totalPrice: `$${(booking.totalCents / 100).toFixed(2)}`,
          status: booking.status,
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create booking';
        return { error: message };
      }
    }

    case 'check_compliance': {
      return dashboardService.getComplianceFlags();
    }

    case 'get_revenue_summary': {
      const startDate = new Date(
        (toolInput.start_date as string) + 'T00:00:00Z'
      );
      const endDate = new Date((toolInput.end_date as string) + 'T23:59:59Z');

      const [payments, pointsTx] = await Promise.all([
        (prisma as any).payment.aggregate({
          where: {
            status: 'completed',
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { totalCents: true },
          _count: { id: true },
        }),
        (prisma as any).pointsTransaction.aggregate({
          where: {
            type: 'purchase',
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      return {
        dateRange: `${toolInput.start_date} to ${toolInput.end_date}`,
        revenue: {
          totalCents: payments._sum.totalCents ?? 0,
          totalFormatted: `$${((payments._sum.totalCents ?? 0) / 100).toFixed(2)}`,
          transactionCount: payments._count.id ?? 0,
        },
        pointsAwarded: {
          totalPoints: pointsTx._sum.amount ?? 0,
          transactionCount: pointsTx._count.id ?? 0,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
