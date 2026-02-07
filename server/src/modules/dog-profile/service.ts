import { prisma } from '../../lib/prisma';
import {
  DogProfileUpdate,
  VaccinationCreate,
  VaccinationUpdate,
  MedicationCreate,
  MedicationUpdate,
  BehaviorNoteCreate,
} from './types';

export class DogProfileService {
  /**
   * Verify that a dog belongs to the specified customer.
   * Throws if not found or ownership mismatch.
   */
  private async verifyDogOwnership(dogId: string, customerId: string) {
    const dog = await prisma.dog.findFirst({
      where: { id: dogId, customerId },
    });
    if (!dog) {
      throw new DogProfileError('Dog not found', 404);
    }
    return dog;
  }

  /**
   * Get all dogs for a customer with vaccination count and active medication count.
   */
  async getDogsByCustomer(customerId: string) {
    const dogs = await prisma.dog.findMany({
      where: { customerId },
      include: {
        _count: {
          select: {
            vaccinations: true,
            medications: { where: { isActive: true } } as any,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return dogs.map((dog) => ({
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      birthDate: dog.birthDate,
      weight: dog.weight,
      temperament: dog.temperament,
      sizeCategory: dog.sizeCategory,
      isNeutered: dog.isNeutered,
      photoUrl: dog.photoUrl,
      vaccinationCount: (dog._count as any).vaccinations,
      activeMedicationCount: (dog._count as any).medications,
    }));
  }

  /**
   * Get full dog profile including vaccinations, medications, and behavior notes.
   * Verifies customer ownership.
   */
  async getDogProfile(dogId: string, customerId: string) {
    await this.verifyDogOwnership(dogId, customerId);

    const dog = await prisma.dog.findUnique({
      where: { id: dogId },
      include: {
        vaccinations: {
          orderBy: { dateGiven: 'desc' },
        },
        medications: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
        behaviorNotes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return dog;
  }

  /**
   * Update dog profile fields. Verifies customer ownership first.
   */
  async updateDogProfile(dogId: string, customerId: string, data: DogProfileUpdate) {
    await this.verifyDogOwnership(dogId, customerId);

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.breed !== undefined) updateData.breed = data.breed;
    if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.temperament !== undefined) updateData.temperament = data.temperament;
    if (data.careInstructions !== undefined) updateData.careInstructions = data.careInstructions;
    if (data.isNeutered !== undefined) updateData.isNeutered = data.isNeutered;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.socialNotes !== undefined) updateData.socialNotes = data.socialNotes;
    if (data.sizeCategory !== undefined) updateData.sizeCategory = data.sizeCategory;

    const dog = await prisma.dog.update({
      where: { id: dogId },
      data: updateData,
    });

    return dog;
  }

  /**
   * Add a vaccination record for a dog. Verifies customer ownership.
   */
  async addVaccination(dogId: string, customerId: string, data: VaccinationCreate) {
    await this.verifyDogOwnership(dogId, customerId);

    const vaccination = await (prisma as any).vaccination.create({
      data: {
        dogId,
        name: data.name,
        dateGiven: new Date(data.dateGiven),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        vetName: data.vetName ?? null,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
      },
    });

    return vaccination;
  }

  /**
   * Update a vaccination record. Verifies dog ownership chain.
   */
  async updateVaccination(
    vaccinationId: string,
    dogId: string,
    customerId: string,
    data: VaccinationUpdate
  ) {
    await this.verifyDogOwnership(dogId, customerId);

    const vaccination = await (prisma as any).vaccination.findFirst({
      where: { id: vaccinationId, dogId },
    });
    if (!vaccination) {
      throw new DogProfileError('Vaccination record not found', 404);
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dateGiven !== undefined) updateData.dateGiven = new Date(data.dateGiven);
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);
    if (data.vetName !== undefined) updateData.vetName = data.vetName;
    if (data.documentUrl !== undefined) updateData.documentUrl = data.documentUrl;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return (prisma as any).vaccination.update({
      where: { id: vaccinationId },
      data: updateData,
    });
  }

  /**
   * Delete a vaccination record. Verifies dog ownership chain.
   */
  async deleteVaccination(vaccinationId: string, dogId: string, customerId: string) {
    await this.verifyDogOwnership(dogId, customerId);

    const vaccination = await (prisma as any).vaccination.findFirst({
      where: { id: vaccinationId, dogId },
    });
    if (!vaccination) {
      throw new DogProfileError('Vaccination record not found', 404);
    }

    await (prisma as any).vaccination.delete({
      where: { id: vaccinationId },
    });

    return { success: true };
  }

  /**
   * Add a medication for a dog. Verifies customer ownership.
   */
  async addMedication(dogId: string, customerId: string, data: MedicationCreate) {
    await this.verifyDogOwnership(dogId, customerId);

    const medication = await (prisma as any).medication.create({
      data: {
        dogId,
        name: data.name,
        dosage: data.dosage ?? null,
        frequency: data.frequency ?? null,
        instructions: data.instructions ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    return medication;
  }

  /**
   * Update a medication record. Verifies dog ownership chain.
   */
  async updateMedication(
    medicationId: string,
    dogId: string,
    customerId: string,
    data: MedicationUpdate
  ) {
    await this.verifyDogOwnership(dogId, customerId);

    const medication = await (prisma as any).medication.findFirst({
      where: { id: medicationId, dogId },
    });
    if (!medication) {
      throw new DogProfileError('Medication not found', 404);
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dosage !== undefined) updateData.dosage = data.dosage;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return (prisma as any).medication.update({
      where: { id: medicationId },
      data: updateData,
    });
  }

  /**
   * Delete a medication record. Verifies dog ownership chain.
   */
  async deleteMedication(medicationId: string, dogId: string, customerId: string) {
    await this.verifyDogOwnership(dogId, customerId);

    const medication = await (prisma as any).medication.findFirst({
      where: { id: medicationId, dogId },
    });
    if (!medication) {
      throw new DogProfileError('Medication not found', 404);
    }

    await (prisma as any).medication.delete({
      where: { id: medicationId },
    });

    return { success: true };
  }

  /**
   * Check a dog's vaccination compliance against VaccinationRequirement table.
   * Returns list of requirements with current status (compliant, expired, missing).
   */
  async getVaccinationCompliance(dogId: string) {
    const requirements = await (prisma as any).vaccinationRequirement.findMany({
      where: { isRequired: true },
    });

    const vaccinations = await (prisma as any).vaccination.findMany({
      where: { dogId },
      orderBy: { dateGiven: 'desc' },
    });

    const now = new Date();

    const compliance = requirements.map((req: any) => {
      // Find the most recent vaccination matching this requirement
      const matching = vaccinations.find((v: any) => v.name === req.vaccinationName);

      if (!matching) {
        return {
          requirement: req.vaccinationName,
          description: req.description,
          status: 'missing' as const,
          lastGiven: null,
          expiresAt: null,
          gracePeriodDays: req.gracePeriodDays,
        };
      }

      // Check if expired
      if (matching.expiresAt) {
        const expiresDate = new Date(matching.expiresAt);
        const graceDate = new Date(expiresDate);
        graceDate.setDate(graceDate.getDate() + req.gracePeriodDays);

        if (now > graceDate) {
          return {
            requirement: req.vaccinationName,
            description: req.description,
            status: 'expired' as const,
            lastGiven: matching.dateGiven,
            expiresAt: matching.expiresAt,
            gracePeriodDays: req.gracePeriodDays,
          };
        }
      }

      return {
        requirement: req.vaccinationName,
        description: req.description,
        status: 'compliant' as const,
        lastGiven: matching.dateGiven,
        expiresAt: matching.expiresAt,
        verified: matching.verified,
        gracePeriodDays: req.gracePeriodDays,
      };
    });

    const isFullyCompliant = compliance.every((c: any) => c.status === 'compliant');

    return { dogId, compliance, isFullyCompliant };
  }

  /**
   * Staff adds a behavior note for a dog.
   */
  async addBehaviorNote(dogId: string, staffUserId: string, data: BehaviorNoteCreate) {
    // Verify the dog exists (staff doesn't need ownership check)
    const dog = await prisma.dog.findUnique({ where: { id: dogId } });
    if (!dog) {
      throw new DogProfileError('Dog not found', 404);
    }

    const note = await (prisma as any).behaviorNote.create({
      data: {
        dogId,
        category: data.category,
        note: data.note,
        severity: data.severity ?? 1,
        reportedBy: staffUserId,
      },
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return note;
  }

  /**
   * Staff verifies a vaccination record.
   */
  async verifyVaccination(vaccinationId: string, staffUserId: string) {
    const vaccination = await (prisma as any).vaccination.findUnique({
      where: { id: vaccinationId },
    });
    if (!vaccination) {
      throw new DogProfileError('Vaccination record not found', 404);
    }

    return (prisma as any).vaccination.update({
      where: { id: vaccinationId },
      data: {
        verified: true,
        verifiedBy: staffUserId,
      },
    });
  }

  /**
   * Get full profile for any dog (admin, no ownership check).
   */
  async getDogProfileAdmin(dogId: string) {
    const dog = await prisma.dog.findUnique({
      where: { id: dogId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        vaccinations: {
          orderBy: { dateGiven: 'desc' },
        },
        medications: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
        behaviorNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!dog) {
      throw new DogProfileError('Dog not found', 404);
    }

    return dog;
  }

  /**
   * Get compliance report for all dogs with expired or missing required vaccinations.
   */
  async getComplianceReport() {
    const requirements = await (prisma as any).vaccinationRequirement.findMany({
      where: { isRequired: true },
    });

    if (requirements.length === 0) {
      return { requirements: [], dogs: [] };
    }

    // Get all dogs with their vaccinations
    const dogs = await prisma.dog.findMany({
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        vaccinations: {
          orderBy: { dateGiven: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const nonCompliantDogs: Array<{
      dog: { id: string; name: string; breed: string | null };
      customer: { id: string; firstName: string; lastName: string; email: string; phone: string };
      issues: Array<{ requirement: string; status: string; expiresAt: Date | null }>;
    }> = [];

    for (const dog of dogs) {
      const issues: Array<{ requirement: string; status: string; expiresAt: Date | null }> = [];

      for (const req of requirements) {
        const matching = (dog.vaccinations as any[]).find(
          (v: any) => v.name === req.vaccinationName
        );

        if (!matching) {
          issues.push({
            requirement: req.vaccinationName,
            status: 'missing',
            expiresAt: null,
          });
          continue;
        }

        if (matching.expiresAt) {
          const expiresDate = new Date(matching.expiresAt);
          const graceDate = new Date(expiresDate);
          graceDate.setDate(graceDate.getDate() + req.gracePeriodDays);

          if (now > graceDate) {
            issues.push({
              requirement: req.vaccinationName,
              status: 'expired',
              expiresAt: matching.expiresAt,
            });
          }
        }
      }

      if (issues.length > 0) {
        nonCompliantDogs.push({
          dog: { id: dog.id, name: dog.name, breed: dog.breed },
          customer: dog.customer as any,
          issues,
        });
      }
    }

    return {
      totalDogs: dogs.length,
      nonCompliantCount: nonCompliantDogs.length,
      requirements: requirements.map((r: any) => ({
        name: r.vaccinationName,
        description: r.description,
        gracePeriodDays: r.gracePeriodDays,
      })),
      dogs: nonCompliantDogs,
    };
  }
}

/**
 * Custom error class for dog profile operations with HTTP status codes.
 */
export class DogProfileError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'DogProfileError';
  }
}
