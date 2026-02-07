import Anthropic from '@anthropic-ai/sdk';
import { BookingService } from '../booking/service';
import { WalletService } from '../wallet/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const bookingService = new BookingService();
const walletService = new WalletService();

// Tool definitions for Claude API
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description: 'Check if a service (daycare, boarding, grooming) is available on specific dates. Always check before creating a booking.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_name: {
          type: 'string',
          description: 'The service type: daycare, boarding, or grooming',
          enum: ['daycare', 'boarding', 'grooming'],
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format. Same as start_date for single-day bookings.',
        },
      },
      required: ['service_name', 'start_date', 'end_date'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a booking for the customer. For boarding (multi-day), use start_date and end_date. For daycare/grooming, start_date and end_date should be the same. Always check availability first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_name: {
          type: 'string',
          description: 'The service type: daycare, boarding, or grooming',
          enum: ['daycare', 'boarding', 'grooming'],
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        dog_names: {
          type: 'array',
          description: 'Names of the dogs to book for. Must match dogs on file.',
          items: { type: 'string' },
        },
        notes: {
          type: 'string',
          description: 'Optional notes for the booking',
        },
      },
      required: ['service_name', 'start_date', 'end_date', 'dog_names'],
    },
  },
  {
    name: 'get_my_bookings',
    description: 'Get the customer\'s upcoming bookings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_past: {
          type: 'boolean',
          description: 'Whether to include past/completed bookings. Defaults to false (upcoming only).',
        },
      },
      required: [],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel a booking by ID. Remind the customer about the 24-hour cancellation policy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        booking_id: {
          type: 'string',
          description: 'The booking ID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation',
        },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'get_wallet_balance',
    description: 'Check the customer\'s wallet balance and loyalty points.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_services_and_pricing',
    description: 'Get the list of available services and their base pricing.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Resolve a friendly service name (daycare, boarding, grooming) to a service type record.
 */
async function resolveServiceType(
  serviceName: string
): Promise<{ id: string; name: string; basePriceCents: number } | null> {
  const serviceTypes = await bookingService.getServiceTypes();
  const match = serviceTypes.find(
    (st: any) => st.name.toLowerCase() === serviceName.toLowerCase()
  );
  return match
    ? { id: match.id, name: match.name, basePriceCents: match.basePriceCents }
    : null;
}

/**
 * Resolve dog names to dog IDs for a customer. Throws if any name is not found.
 */
async function resolveDogIds(
  customerId: string,
  dogNames: string[]
): Promise<{ id: string; name: string }[]> {
  const dogs = await prisma.dog.findMany({
    where: { customerId },
  });

  return dogNames.map((name) => {
    const match = dogs.find(
      (d) => d.name.toLowerCase() === name.toLowerCase()
    );
    if (!match) {
      throw new Error(`Dog "${name}" not found on your account`);
    }
    return { id: match.id, name: match.name };
  });
}

/**
 * Execute a tool call and return the result as a JSON-serializable object.
 * The customerId is resolved from the SMS sender's phone number before this is called.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  customerId: string | null
): Promise<unknown> {
  logger.info(`Executing tool: ${toolName}`, { input: toolInput, customerId });

  switch (toolName) {
    case 'check_availability': {
      const serviceType = await resolveServiceType(toolInput.service_name as string);
      if (!serviceType) {
        return { error: `Unknown service: ${toolInput.service_name}` };
      }

      const startDate = new Date(`${toolInput.start_date as string}T00:00:00Z`);
      const endDate = new Date(`${toolInput.end_date as string}T00:00:00Z`);
      const availability = await bookingService.checkAvailability(
        serviceType.id,
        startDate,
        endDate
      );

      return {
        service: serviceType.name,
        basePrice: `$${(serviceType.basePriceCents / 100).toFixed(2)}`,
        dates: availability.map((a) => ({
          date: a.date,
          available: a.available,
          spotsLeft: a.spotsRemaining,
        })),
      };
    }

    case 'create_booking': {
      if (!customerId) {
        return {
          error: 'You need an account to make bookings. Please visit us or call to set up your account first.',
        };
      }

      const serviceType = await resolveServiceType(toolInput.service_name as string);
      if (!serviceType) {
        return { error: `Unknown service: ${toolInput.service_name}` };
      }

      const dogNames = toolInput.dog_names as string[];
      let dogs: { id: string; name: string }[];
      try {
        dogs = await resolveDogIds(customerId, dogNames);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to resolve dog names';
        return { error: message };
      }

      const startDateStr = toolInput.start_date as string;
      const endDateStr = toolInput.end_date as string;
      const isMultiDay = startDateStr !== endDateStr;

      try {
        let booking: any;
        if (isMultiDay) {
          booking = await bookingService.createMultiDayBooking({
            customerId,
            serviceTypeId: serviceType.id,
            startDate: startDateStr,
            endDate: endDateStr,
            dogIds: dogs.map((d) => d.id),
            notes: (toolInput.notes as string) || undefined,
          });
        } else {
          booking = await bookingService.createBooking({
            customerId,
            serviceTypeId: serviceType.id,
            date: startDateStr,
            dogIds: dogs.map((d) => d.id),
            notes: (toolInput.notes as string) || undefined,
          });
        }

        return {
          success: true,
          bookingId: booking.id,
          service: serviceType.name,
          date: isMultiDay ? `${startDateStr} to ${endDateStr}` : startDateStr,
          dogs: dogs.map((d) => d.name),
          totalPrice: `$${(booking.totalCents / 100).toFixed(2)}`,
          status: booking.status,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create booking';
        return { error: message };
      }
    }

    case 'get_my_bookings': {
      if (!customerId) {
        return { error: 'No account found for this phone number.' };
      }

      const includePast = toolInput.include_past as boolean;
      const result = await bookingService.getCustomerBookings(customerId, {
        status: includePast ? undefined : 'confirmed',
        limit: 10,
      });

      return {
        total: result.total,
        bookings: result.bookings.map((b: any) => ({
          id: b.id,
          service: b.serviceType?.name || 'Unknown',
          date:
            b.startDate && b.endDate
              ? `${new Date(b.startDate).toISOString().split('T')[0]} to ${new Date(b.endDate).toISOString().split('T')[0]}`
              : new Date(b.date).toISOString().split('T')[0],
          dogs:
            b.dogs?.map((bd: any) => bd.dog?.name).filter(Boolean) || [],
          status: b.status,
          price: `$${(b.totalCents / 100).toFixed(2)}`,
        })),
      };
    }

    case 'cancel_booking': {
      if (!customerId) {
        return { error: 'No account found for this phone number.' };
      }

      try {
        const booking = await bookingService.cancelBooking(
          toolInput.booking_id as string,
          customerId,
          (toolInput.reason as string) || undefined
        );
        return {
          success: true,
          bookingId: booking.id,
          status: 'cancelled',
          message: 'Booking has been cancelled.',
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to cancel booking';
        return { error: message };
      }
    }

    case 'get_wallet_balance': {
      if (!customerId) {
        return { error: 'No account found for this phone number.' };
      }

      try {
        const balance = await walletService.getBalance(customerId);
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { pointsBalance: true },
        });

        return {
          walletBalance: `$${(balance.balanceCents / 100).toFixed(2)}`,
          tier: balance.tier,
          loyaltyPoints: customer?.pointsBalance ?? 0,
          maxPoints: 500,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to retrieve wallet balance';
        return { error: message };
      }
    }

    case 'get_services_and_pricing': {
      const types = await bookingService.getServiceTypes();
      return {
        services: types
          .filter((t: any) => t.isActive)
          .map((t: any) => ({
            name: t.name,
            basePrice: `$${(t.basePriceCents / 100).toFixed(2)}`,
            duration: t.durationMinutes
              ? `${t.durationMinutes} min`
              : 'Full day',
          })),
        notes:
          'Grooming price varies by dog size and coat condition. Multi-dog discount: 10% off for 2+ dogs.',
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
