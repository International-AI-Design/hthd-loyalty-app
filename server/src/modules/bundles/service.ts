import { prisma } from '../../lib/prisma';

export class BundleService {
  /**
   * Get all active bundles with their service types
   */
  async getActiveBundles() {
    return (prisma as any).serviceBundle.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            serviceType: {
              select: { id: true, name: true, displayName: true, basePriceCents: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get bundle suggestions for a specific service type (for upsell)
   */
  async getBundleSuggestions(serviceTypeId: string) {
    return (prisma as any).serviceBundle.findMany({
      where: {
        isActive: true,
        items: {
          some: { serviceTypeId },
        },
      },
      include: {
        items: {
          include: {
            serviceType: {
              select: { id: true, name: true, displayName: true, basePriceCents: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Calculate bundle price with discount applied
   */
  async calculateBundlePrice(bundleId: string, dogIds: string[]) {
    const bundle = await (prisma as any).serviceBundle.findUnique({
      where: { id: bundleId },
      include: {
        items: {
          include: {
            serviceType: true,
          },
        },
      },
    });
    if (!bundle) {
      throw new BundleError('Bundle not found', 404);
    }
    if (!bundle.isActive) {
      throw new BundleError('Bundle is no longer available', 400);
    }

    const dogCount = dogIds.length;
    if (dogCount < 1) {
      throw new BundleError('At least one dog is required', 400);
    }

    // Calculate base total (sum of all service base prices × dog count)
    const baseTotalCents = bundle.items.reduce(
      (sum: number, item: any) => sum + item.serviceType.basePriceCents * dogCount,
      0
    );

    // Apply discount
    let discountCents = 0;
    if (bundle.discountType === 'percentage') {
      discountCents = Math.round(baseTotalCents * bundle.discountValue / 100);
    } else if (bundle.discountType === 'fixed') {
      discountCents = bundle.discountValue;
    }

    const finalTotalCents = Math.max(0, baseTotalCents - discountCents);

    return {
      bundle: {
        id: bundle.id,
        name: bundle.name,
        discountType: bundle.discountType,
        discountValue: bundle.discountValue,
      },
      services: bundle.items.map((item: any) => ({
        serviceType: item.serviceType.displayName,
        basePriceCents: item.serviceType.basePriceCents * dogCount,
      })),
      dogCount,
      baseTotalCents,
      discountCents,
      finalTotalCents,
    };
  }

  /**
   * Create a new bundle (owner only)
   */
  async createBundle(data: {
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
    serviceTypeIds: string[];
    sortOrder?: number;
  }) {
    if (!['percentage', 'fixed'].includes(data.discountType)) {
      throw new BundleError('discountType must be "percentage" or "fixed"', 400);
    }
    if (data.serviceTypeIds.length < 2) {
      throw new BundleError('A bundle must include at least 2 service types', 400);
    }

    // Verify all service types exist
    const serviceTypes = await (prisma as any).serviceType.findMany({
      where: { id: { in: data.serviceTypeIds } },
    });
    if (serviceTypes.length !== data.serviceTypeIds.length) {
      throw new BundleError('One or more service types not found', 400);
    }

    return (prisma as any).serviceBundle.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        sortOrder: data.sortOrder ?? 0,
        items: {
          create: data.serviceTypeIds.map((serviceTypeId) => ({
            serviceTypeId,
          })),
        },
      },
      include: {
        items: {
          include: {
            serviceType: {
              select: { id: true, name: true, displayName: true, basePriceCents: true },
            },
          },
        },
      },
    });
  }

  /**
   * Update a bundle (owner only)
   */
  async updateBundle(
    id: string,
    data: {
      name?: string;
      description?: string;
      discountType?: string;
      discountValue?: number;
      serviceTypeIds?: string[];
      sortOrder?: number;
    }
  ) {
    const existing = await (prisma as any).serviceBundle.findUnique({ where: { id } });
    if (!existing) {
      throw new BundleError('Bundle not found', 404);
    }

    if (data.discountType && !['percentage', 'fixed'].includes(data.discountType)) {
      throw new BundleError('discountType must be "percentage" or "fixed"', 400);
    }

    // If service types are being updated, replace all items
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    if (data.serviceTypeIds) {
      if (data.serviceTypeIds.length < 2) {
        throw new BundleError('A bundle must include at least 2 service types', 400);
      }
      // Delete existing items and recreate
      await (prisma as any).serviceBundleItem.deleteMany({ where: { bundleId: id } });
      updateData.items = {
        create: data.serviceTypeIds.map((serviceTypeId) => ({ serviceTypeId })),
      };
    }

    return (prisma as any).serviceBundle.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            serviceType: {
              select: { id: true, name: true, displayName: true, basePriceCents: true },
            },
          },
        },
      },
    });
  }

  /**
   * Toggle bundle active/inactive (soft delete)
   */
  async toggleBundle(id: string) {
    const bundle = await (prisma as any).serviceBundle.findUnique({ where: { id } });
    if (!bundle) {
      throw new BundleError('Bundle not found', 404);
    }
    return (prisma as any).serviceBundle.update({
      where: { id },
      data: { isActive: !bundle.isActive },
    });
  }
}

export class BundleError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'BundleError';
  }
}
