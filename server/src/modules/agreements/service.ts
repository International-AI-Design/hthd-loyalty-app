import { prisma } from '../../lib/prisma';
import type { AgreementCreate, AgreementUpdate, SignatureCreate, BoardingDetailUpdate } from './types';

export class AgreementService {
  async getAgreements() {
    return prisma.serviceAgreement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAgreement(id: string) {
    const agreement = await prisma.serviceAgreement.findUnique({ where: { id } });
    if (!agreement) {
      throw new AgreementError('Agreement not found', 404);
    }
    return agreement;
  }

  async getRequiredAgreements(serviceType: string) {
    return prisma.serviceAgreement.findMany({
      where: {
        isActive: true,
        requiredFor: { has: serviceType },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getCustomerSignatures(customerId: string) {
    return prisma.agreementSignature.findMany({
      where: { customerId },
      include: {
        agreement: {
          select: { displayName: true, version: true },
        },
      },
      orderBy: { signedAt: 'desc' },
    });
  }

  async checkCompliance(customerId: string, serviceType: string) {
    const required = await this.getRequiredAgreements(serviceType);
    const signatures = await prisma.agreementSignature.findMany({
      where: { customerId },
      select: { agreementId: true },
    });

    const signedIds = new Set(signatures.map((s) => s.agreementId));

    const signed = required.filter((a) => signedIds.has(a.id));
    const missing = required.filter((a) => !signedIds.has(a.id));

    return {
      compliant: missing.length === 0,
      missing,
      signed,
    };
  }

  async signAgreement(
    data: SignatureCreate,
    customerId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verify agreement exists and is active
    const agreement = await prisma.serviceAgreement.findUnique({
      where: { id: data.agreementId },
    });
    if (!agreement || !agreement.isActive) {
      throw new AgreementError('Agreement not found or inactive', 404);
    }

    // Prevent duplicate signatures
    const existing = await prisma.agreementSignature.findFirst({
      where: {
        agreementId: data.agreementId,
        customerId,
      },
    });
    if (existing) {
      throw new AgreementError('Agreement already signed', 409);
    }

    return prisma.agreementSignature.create({
      data: {
        agreementId: data.agreementId,
        customerId,
        typedName: data.typedName,
        agreedToTerms: true,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
      include: {
        agreement: {
          select: { displayName: true, version: true },
        },
      },
    });
  }

  // --- Admin methods ---

  async getAllAgreements() {
    return prisma.serviceAgreement.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAgreement(data: AgreementCreate) {
    return prisma.serviceAgreement.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        content: data.content,
        requiredFor: data.requiredFor,
        version: data.version ?? 1,
      },
    });
  }

  async updateAgreement(id: string, data: AgreementUpdate) {
    const agreement = await prisma.serviceAgreement.findUnique({ where: { id } });
    if (!agreement) {
      throw new AgreementError('Agreement not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.requiredFor !== undefined) updateData.requiredFor = data.requiredFor;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Bump version if content changed
    if (data.content !== undefined && data.content !== agreement.content) {
      updateData.content = data.content;
      updateData.version = agreement.version + 1;
    }

    return prisma.serviceAgreement.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivateAgreement(id: string) {
    const agreement = await prisma.serviceAgreement.findUnique({ where: { id } });
    if (!agreement) {
      throw new AgreementError('Agreement not found', 404);
    }

    return prisma.serviceAgreement.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getSignaturesFiltered(filters: { customerId?: string; agreementId?: string }) {
    const where: Record<string, string> = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.agreementId) where.agreementId = filters.agreementId;

    return prisma.agreementSignature.findMany({
      where,
      include: {
        agreement: { select: { displayName: true, version: true, name: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { signedAt: 'desc' },
    });
  }

  // --- Boarding Detail methods ---

  async getBoardingDetail(bookingId: string, customerId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) {
      throw new AgreementError('Booking not found', 404);
    }

    const detail = await prisma.boardingDetail.findUnique({
      where: { bookingId },
    });
    if (!detail) {
      throw new AgreementError('Boarding detail not found', 404);
    }

    return detail;
  }

  async upsertBoardingDetail(bookingId: string, customerId: string, data: BoardingDetailUpdate) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) {
      throw new AgreementError('Booking not found', 404);
    }

    // Only allow updates before check-in
    if (booking.status === 'checked_in' || booking.status === 'checked_out') {
      throw new AgreementError('Cannot update boarding details after check-in', 400);
    }

    return prisma.boardingDetail.upsert({
      where: { bookingId },
      create: {
        bookingId,
        feedingSchedule: data.feedingSchedule ?? null,
        foodType: data.foodType ?? null,
        foodBrand: data.foodBrand ?? null,
        feedingNotes: data.feedingNotes ?? null,
        dropOffTime: data.dropOffTime ?? null,
        pickUpTime: data.pickUpTime ?? null,
        specialItems: data.specialItems ?? null,
        emergencyContact: data.emergencyContact ?? null,
      },
      update: {
        feedingSchedule: data.feedingSchedule ?? undefined,
        foodType: data.foodType ?? undefined,
        foodBrand: data.foodBrand ?? undefined,
        feedingNotes: data.feedingNotes ?? undefined,
        dropOffTime: data.dropOffTime ?? undefined,
        pickUpTime: data.pickUpTime ?? undefined,
        specialItems: data.specialItems ?? undefined,
        emergencyContact: data.emergencyContact ?? undefined,
      },
    });
  }
}

export class AgreementError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AgreementError';
  }
}
