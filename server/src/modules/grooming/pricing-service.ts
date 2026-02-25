import { ok, err, okAsync, errAsync, ResultAsync } from 'neverthrow';
import { prisma } from '../../lib/prisma';
import type {
  PricingError,
  AddOnError,
  GroomingServicePriceCreate,
  GroomingServicePriceUpdate,
  GroomingAddOnCreate,
  GroomingAddOnUpdate,
} from './types';

// --- Pure Calculations (functional core — no DB, no side effects) ---

export function calculateGroomingTotal(
  basePriceCents: number,
  addOns: { priceCents: number }[],
): number {
  return basePriceCents + addOns.reduce((sum, a) => sum + a.priceCents, 0);
}

// --- Service Methods (imperative shell — returns Result, never throws) ---

export function getServicePrices(
  subServiceId?: string,
): ResultAsync<any[], PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findMany({
      where: {
        isActive: true,
        ...(subServiceId ? { subServiceId } : {}),
      },
      include: { subService: true },
      orderBy: { subService: { sortOrder: 'asc' } },
    }),
    (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function getServicePrice(
  subServiceId: string,
  sizeCategory?: string,
): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findFirst({
      where: {
        subServiceId,
        sizeCategory: sizeCategory ?? null,
        isActive: true,
      },
      include: { subService: true },
    }),
    (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((price) =>
    price
      ? okAsync(price)
      : errAsync({ type: 'NOT_FOUND' as const, entity: 'ServicePrice', id: subServiceId }),
  );
}

export function createServicePrice(
  data: GroomingServicePriceCreate,
): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findFirst({
      where: {
        subServiceId: data.subServiceId,
        sizeCategory: data.sizeCategory ?? null,
      },
    }),
    (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) =>
    existing
      ? errAsync<any, PricingError>({
          type: 'DUPLICATE_PRICE',
          subServiceId: data.subServiceId,
          sizeCategory: data.sizeCategory ?? null,
        })
      : ResultAsync.fromPromise(
          prisma.groomingServicePrice.create({
            data: {
              subServiceId: data.subServiceId,
              sizeCategory: data.sizeCategory ?? null,
              priceCents: data.priceCents,
            },
          }),
          (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
        ),
  );
}

export function updateServicePrice(
  id: string,
  data: GroomingServicePriceUpdate,
): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findUnique({ where: { id } }),
    (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) =>
    existing
      ? ResultAsync.fromPromise(
          prisma.groomingServicePrice.update({ where: { id }, data }),
          (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
        )
      : errAsync<any, PricingError>({ type: 'NOT_FOUND', entity: 'ServicePrice', id }),
  );
}

export function getAddOns(
  includeInactive = false,
): ResultAsync<any[], AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    (e): AddOnError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function createAddOn(
  data: GroomingAddOnCreate,
): ResultAsync<any, AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findFirst({ where: { name: data.name } }),
    (e): AddOnError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) =>
    existing
      ? errAsync<any, AddOnError>({ type: 'DUPLICATE_NAME', name: data.name })
      : ResultAsync.fromPromise(
          prisma.groomingAddOn.create({ data }),
          (e): AddOnError => ({ type: 'DB_ERROR', cause: e }),
        ),
  );
}

export function updateAddOn(
  id: string,
  data: GroomingAddOnUpdate,
): ResultAsync<any, AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findUnique({ where: { id } }),
    (e): AddOnError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) =>
    existing
      ? ResultAsync.fromPromise(
          prisma.groomingAddOn.update({ where: { id }, data }),
          (e): AddOnError => ({ type: 'DB_ERROR', cause: e }),
        )
      : errAsync<any, AddOnError>({ type: 'NOT_FOUND', id }),
  );
}

export function deleteAddOn(id: string): ResultAsync<any, AddOnError> {
  return updateAddOn(id, { isActive: false });
}

export function getFullPricingSheet(): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingSubService.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: { sizeCategory: 'asc' },
        },
      },
    }),
    (e): PricingError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((subServices) =>
    getAddOns().mapErr((e): PricingError => ({ type: 'DB_ERROR', cause: e })).map((addOns) => ({
      subServices: subServices.map((s) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        isCoatRelated: s.isCoatRelated,
        prices: s.prices.map((p) => ({
          sizeCategory: p.sizeCategory,
          priceCents: p.priceCents,
        })),
      })),
      addOns,
    })),
  );
}
