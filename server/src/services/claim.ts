import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { sendVerificationEmail, sendWelcomeEmail } from './email';
import { logger } from '../middleware/security';

const SALT_ROUNDS = 10;
const CODE_EXPIRY_MINUTES = 10;

interface DogInfo {
  id: string;
  name: string;
  breed: string | null;
}

interface VisitInfo {
  id: string;
  visitDate: Date;
  serviceType: string;
  description: string | null;
  amount: number;
}

interface UnclaimedCustomer {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  pointsBalance: number;
  dogs?: DogInfo[];
  recentVisits?: VisitInfo[];
}

/**
 * Find an unclaimed customer by email or phone
 * Returns customer info along with their dogs and recent visit history
 */
export async function findUnclaimedCustomer(
  identifier: string
): Promise<{ customer: UnclaimedCustomer | null; error?: string }> {
  try {
    const isEmail = identifier.includes('@');

    const customer = await prisma.customer.findFirst({
      where: {
        accountStatus: 'unclaimed',
        ...(isEmail
          ? { email: identifier.toLowerCase() }
          : { phone: { contains: identifier.replace(/\D/g, '').slice(-10) } }
        ),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        pointsBalance: true,
        accountStatus: true,
        dogs: {
          select: {
            id: true,
            name: true,
            breed: true,
          },
          orderBy: { name: 'asc' },
        },
        gingrVisits: {
          select: {
            id: true,
            visitDate: true,
            serviceType: true,
            description: true,
            amount: true,
          },
          orderBy: { visitDate: 'desc' },
          take: 5, // Show last 5 visits in preview
        },
      },
    });

    if (!customer) {
      return { customer: null };
    }

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        pointsBalance: customer.pointsBalance,
        dogs: customer.dogs.map((dog) => ({
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
        })),
        recentVisits: customer.gingrVisits.map((visit) => ({
          id: visit.id,
          visitDate: visit.visitDate,
          serviceType: visit.serviceType,
          description: visit.description,
          amount: Number(visit.amount),
        })),
      },
    };
  } catch (error) {
    logger.error('Error finding unclaimed customer:', error);
    return {
      customer: null,
      error: 'Failed to search for customer',
    };
  }
}

/**
 * Generate a random 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and send a verification code to the customer
 */
export async function sendVerificationCode(
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        accountStatus: true,
      },
    });

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (customer.accountStatus !== 'unclaimed') {
      return { success: false, error: 'Account has already been claimed' };
    }

    // Invalidate any existing unused codes for this customer
    await prisma.verificationCode.updateMany({
      where: {
        customerId,
        type: 'claim',
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Save code to database
    await prisma.verificationCode.create({
      data: {
        customerId,
        code,
        type: 'claim',
        expiresAt,
      },
    });

    // Send email with code
    const emailResult = await sendVerificationEmail({
      to: customer.email,
      customerName: customer.firstName,
      code,
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error };
    }

    return { success: true };
  } catch (error) {
    logger.error('Error sending verification code:', error);
    return {
      success: false,
      error: 'Failed to send verification code',
    };
  }
}

/**
 * Verify a code for a customer
 */
export async function verifyCode(
  customerId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        customerId,
        code,
        type: 'claim',
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!verificationCode) {
      // Check if code exists but is expired or used
      const anyCode = await prisma.verificationCode.findFirst({
        where: {
          customerId,
          code,
          type: 'claim',
        },
      });

      if (anyCode) {
        if (anyCode.usedAt) {
          return { valid: false, error: 'This code has already been used' };
        }
        if (anyCode.expiresAt < new Date()) {
          return { valid: false, error: 'This code has expired. Please request a new one.' };
        }
      }

      return { valid: false, error: 'Invalid verification code' };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Error verifying code:', error);
    return {
      valid: false,
      error: 'Failed to verify code',
    };
  }
}

/**
 * Complete the claim process - set password and activate account
 */
export async function completeClaim(
  customerId: string,
  code: string,
  password: string
): Promise<{ success: boolean; customer?: UnclaimedCustomer; error?: string }> {
  try {
    // Verify the code first
    const codeResult = await verifyCode(customerId, code);
    if (!codeResult.valid) {
      return { success: false, error: codeResult.error };
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update customer and mark code as used in a transaction
    const customer = await prisma.$transaction(async (tx) => {
      // Mark the code as used
      await tx.verificationCode.updateMany({
        where: {
          customerId,
          code,
          type: 'claim',
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // Update customer account
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          passwordHash,
          accountStatus: 'active',
          claimedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          pointsBalance: true,
        },
      });

      return updatedCustomer;
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({
      to: customer.email,
      customerName: customer.firstName,
      pointsBalance: customer.pointsBalance,
    }).catch((err) => {
      logger.error('Failed to send welcome email:', err);
    });

    return {
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        pointsBalance: customer.pointsBalance,
      },
    };
  } catch (error) {
    logger.error('Error completing claim:', error);
    return {
      success: false,
      error: 'Failed to complete account claim',
    };
  }
}
