import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { capPoints } from '../lib/points';
import { logger } from '../middleware/security';

const GINGR_API_KEY = process.env.GINGR_API_KEY || '';
const GINGR_SUBDOMAIN = process.env.GINGR_SUBDOMAIN || '';
const GINGR_BASE_URL = `https://${GINGR_SUBDOMAIN}.gingrapp.com/api/v1`;

// Auth formats to try (the plan mentioned 403 suggesting wrong format)
const AUTH_FORMATS = [
  { name: 'Token Header', getHeaders: () => ({ 'Authorization': `Token ${GINGR_API_KEY}` }) },
  { name: 'Bearer Header', getHeaders: () => ({ 'Authorization': `Bearer ${GINGR_API_KEY}` }) },
  { name: 'X-Authorization Header', getHeaders: () => ({ 'X-Authorization': GINGR_API_KEY }) },
  { name: 'Query Param', getHeaders: () => ({}), useQueryParam: true },
];

// Gingr Animal structure (from /animals endpoint)
interface GingrAnimal {
  animal_id: string;
  name: string;
  breed?: string;
  species?: string;
  birth_date?: string;
  owner_id: string;
}

// Gingr Reservation structure (from /reservations endpoint)
interface GingrReservation {
  reservation_id: string;
  start_date: string;
  end_date: string;
  check_out_date?: string;
  reservation_type?: {
    id: string;
    type: string;
  };
  owner: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    cell_phone?: string;
    home_phone?: string;
  };
  services?: Array<{
    id: string;
    name: string;
    cost: number;
  }>;
  transaction?: {
    pos_transaction_id: number;
    price: number;
  };
  deposit?: {
    amount: number;
  };
}

// Normalized invoice structure for internal use
interface GingrInvoice {
  id: string;
  invoice_number: string;
  owner_id?: string; // For fetching animals
  owner_name: string;
  owner_email?: string;
  owner_phone?: string;
  total: number;
  status: string;
  created_at: string;
  completed_at?: string;
  line_items?: Array<{
    service_type?: string;
    description?: string;
    amount: number;
  }>;
}

interface ConnectionTestResult {
  connected: boolean;
  authFormat?: string;
  error?: string;
}

interface SyncResult {
  success: boolean;
  importId?: string;
  invoicesProcessed: number;
  customersMatched: number;
  customersNotFound: number;
  totalPointsApplied: number;
  unmatchedCustomers: Array<{
    ownerName: string;
    invoiceId: string;
    total: number;
  }>;
  error?: string;
}

// Store the working auth format once discovered
let workingAuthFormat: typeof AUTH_FORMATS[0] | null = null;

/**
 * Test connection to Gingr API, trying different auth formats
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  if (!GINGR_API_KEY || !GINGR_SUBDOMAIN) {
    return {
      connected: false,
      error: 'Gingr API credentials not configured. Please set GINGR_API_KEY and GINGR_SUBDOMAIN in environment.',
    };
  }

  // If we already found a working format, use it
  if (workingAuthFormat) {
    try {
      const url = workingAuthFormat.useQueryParam
        ? `${GINGR_BASE_URL}/owners?key=${GINGR_API_KEY}&limit=1`
        : `${GINGR_BASE_URL}/owners?limit=1`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...workingAuthFormat.getHeaders(),
        },
      });

      if (response.ok) {
        return { connected: true, authFormat: workingAuthFormat.name };
      }
    } catch {
      // If cached format fails, try all formats again
      workingAuthFormat = null;
    }
  }

  // Try each auth format
  for (const authFormat of AUTH_FORMATS) {
    try {
      const url = authFormat.useQueryParam
        ? `${GINGR_BASE_URL}/owners?key=${GINGR_API_KEY}&limit=1`
        : `${GINGR_BASE_URL}/owners?limit=1`;

      logger.info(`Testing Gingr connection with ${authFormat.name}...`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...authFormat.getHeaders(),
        },
      });

      if (response.ok) {
        workingAuthFormat = authFormat;
        logger.info(`Gingr connection successful with ${authFormat.name}`);
        return { connected: true, authFormat: authFormat.name };
      }

      logger.warn(`Gingr auth format ${authFormat.name} returned ${response.status}`);
    } catch (error) {
      logger.warn(`Gingr auth format ${authFormat.name} failed: ${error}`);
    }
  }

  return {
    connected: false,
    error: 'Unable to connect to Gingr API. Please verify API key has correct permissions.',
  };
}

/**
 * Convert Gingr reservation to our internal invoice format
 */
function reservationToInvoice(reservation: GingrReservation): GingrInvoice {
  const owner = reservation.owner;
  const total = reservation.transaction?.price || reservation.deposit?.amount || 0;

  // Convert services to line_items format
  const line_items = (reservation.services || []).map(s => ({
    service_type: s.name,
    description: s.name,
    amount: s.cost,
  }));

  return {
    id: reservation.reservation_id,
    invoice_number: `RES-${reservation.reservation_id}`,
    owner_id: owner.id,
    owner_name: `${owner.first_name} ${owner.last_name}`.trim(),
    owner_email: owner.email,
    owner_phone: owner.cell_phone || owner.home_phone,
    total,
    status: 'completed',
    created_at: reservation.start_date,
    completed_at: reservation.check_out_date || reservation.end_date,
    line_items,
  };
}

/**
 * Fetch reservations from Gingr API and convert to invoice format
 * Uses POST /reservations endpoint with date range (max 31 days)
 */
async function fetchInvoices(since?: Date): Promise<GingrInvoice[]> {
  if (!workingAuthFormat) {
    const test = await testConnection();
    if (!test.connected) {
      throw new Error(test.error || 'Unable to connect to Gingr');
    }
  }

  try {
    // Gingr requires date range, max 31 days
    const endDate = new Date();
    const startDate = since || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formData = new URLSearchParams();
    formData.append('start_date', startDate.toISOString().split('T')[0]);
    formData.append('end_date', endDate.toISOString().split('T')[0]);
    if (workingAuthFormat?.useQueryParam) {
      formData.append('key', GINGR_API_KEY);
    }

    const response = await fetch(`${GINGR_BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(workingAuthFormat?.getHeaders() || {}),
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Gingr API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { error: boolean; data?: Record<string, GingrReservation>; message?: string };

    if (data.error) {
      throw new Error(data.message || 'Gingr API returned an error');
    }

    // Convert reservations to invoice format, filter out those with no price
    const reservations = Object.values(data.data || {});
    return reservations
      .filter(r => (r.transaction?.price || 0) > 0 || (r.deposit?.amount || 0) > 0)
      .map(reservationToInvoice);
  } catch (error) {
    logger.error('Failed to fetch Gingr reservations:', error);
    throw error;
  }
}

/**
 * Match owner name to customer in database
 * Uses fuzzy matching on name, phone, or email
 */
async function matchCustomer(
  ownerName: string,
  ownerEmail?: string,
  ownerPhone?: string
): Promise<string | null> {
  // Try exact email match first
  if (ownerEmail) {
    const byEmail = await prisma.customer.findUnique({
      where: { email: ownerEmail.toLowerCase() },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  // Try phone match (normalize phone number)
  if (ownerPhone) {
    const normalizedPhone = ownerPhone.replace(/\D/g, '');
    const byPhone = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: normalizedPhone.slice(-10), // Last 10 digits
        },
      },
      select: { id: true },
    });
    if (byPhone) return byPhone.id;
  }

  // Try name match (first + last name)
  const nameParts = ownerName.trim().toLowerCase().split(/\s+/);
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    const byName = await prisma.customer.findFirst({
      where: {
        AND: [
          { firstName: { equals: firstName, mode: 'insensitive' } },
          { lastName: { equals: lastName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (byName) return byName.id;
  }

  return null;
}

/**
 * Calculate points for an invoice
 * Uses 1.5x multiplier for grooming services
 */
function calculatePoints(invoice: GingrInvoice): { points: number; hasGrooming: boolean } {
  const total = typeof invoice.total === 'number' ? invoice.total : parseFloat(String(invoice.total));

  // Check if invoice contains grooming service
  const hasGrooming = invoice.line_items?.some(item =>
    item.service_type?.toLowerCase().includes('groom') ||
    item.description?.toLowerCase().includes('groom')
  ) || false;

  // Apply 1.5x multiplier for grooming, 1x for other services
  const multiplier = hasGrooming ? 1.5 : 1;
  const points = Math.floor(total * multiplier);

  return { points, hasGrooming };
}

/**
 * Sync invoices from Gingr and apply points
 */
export async function syncInvoices(staffId: string): Promise<SyncResult> {
  const unmatchedCustomers: SyncResult['unmatchedCustomers'] = [];

  try {
    // Get the last sync time to only fetch new invoices
    const lastSync = await prisma.gingrImport.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });

    // Fetch invoices from Gingr
    const invoices = await fetchInvoices(lastSync?.syncedAt);

    if (invoices.length === 0) {
      return {
        success: true,
        invoicesProcessed: 0,
        customersMatched: 0,
        customersNotFound: 0,
        totalPointsApplied: 0,
        unmatchedCustomers: [],
      };
    }

    // Create the import record
    const gingrImport = await prisma.gingrImport.create({
      data: {
        uploadedBy: staffId,
        invoicesProcessed: 0,
        customersMatched: 0,
        customersNotFound: 0,
        totalPointsApplied: 0,
      },
    });

    let customersMatched = 0;
    let customersNotFound = 0;
    let totalPointsApplied = 0;

    // Process each invoice
    for (const invoice of invoices) {
      // Check if we've already processed this invoice
      const existingRow = await prisma.gingrImportRow.findUnique({
        where: { gingrInvoiceId: invoice.id },
      });

      if (existingRow) {
        logger.info(`Skipping already processed invoice: ${invoice.id}`);
        continue;
      }

      // Try to match the customer
      const customerId = await matchCustomer(
        invoice.owner_name,
        invoice.owner_email,
        invoice.owner_phone
      );

      const { points, hasGrooming } = calculatePoints(invoice);

      if (customerId) {
        // Create the import row and apply points in a transaction
        await prisma.$transaction(async (tx) => {
          // Create import row
          await tx.gingrImportRow.create({
            data: {
              importId: gingrImport.id,
              gingrInvoiceId: invoice.id,
              ownerName: invoice.owner_name,
              invoiceTotal: new Prisma.Decimal(invoice.total),
              customerId,
              status: 'matched',
              pointsApplied: points,
            },
          });

          // Get current balance for cap calculation
          const currentCustomer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { pointsBalance: true },
          });

          const { pointsAwarded, pointsCapped } = capPoints(
            currentCustomer?.pointsBalance ?? 0,
            points
          );

          // Update import row with actual points applied (may be less due to cap)
          if (pointsAwarded > 0) {
            // Add points to customer (capped)
            await tx.customer.update({
              where: { id: customerId },
              data: {
                pointsBalance: { increment: pointsAwarded },
              },
            });

            // Create points transaction with actual awarded amount
            await tx.pointsTransaction.create({
              data: {
                customerId,
                type: 'purchase',
                amount: pointsAwarded,
                description: `Gingr sync: Invoice ${invoice.invoice_number || invoice.id}${hasGrooming ? ' (1.5x grooming bonus)' : ''}${pointsCapped > 0 ? ` (${pointsCapped} pts capped at max)` : ''}`,
                serviceType: hasGrooming ? 'grooming' : 'daycare',
                dollarAmount: new Prisma.Decimal(invoice.total),
              },
            });
          }

          // Create audit log
          await tx.auditLog.create({
            data: {
              staffUserId: staffId,
              action: 'gingr_sync_points',
              entityType: 'customer',
              entityId: customerId,
              details: {
                gingrInvoiceId: invoice.id,
                invoiceTotal: invoice.total,
                pointsCalculated: points,
                pointsApplied: pointsAwarded,
                pointsCapped,
                hasGrooming,
              },
            },
          });
        });

        customersMatched++;
        totalPointsApplied += points;
      } else {
        // Create import row as unmatched
        await prisma.gingrImportRow.create({
          data: {
            importId: gingrImport.id,
            gingrInvoiceId: invoice.id,
            ownerName: invoice.owner_name,
            invoiceTotal: new Prisma.Decimal(invoice.total),
            status: 'unmatched',
            pointsApplied: 0,
          },
        });

        customersNotFound++;
        unmatchedCustomers.push({
          ownerName: invoice.owner_name,
          invoiceId: invoice.id,
          total: invoice.total,
        });
      }
    }

    // Update the import record with totals
    await prisma.gingrImport.update({
      where: { id: gingrImport.id },
      data: {
        invoicesProcessed: invoices.length,
        customersMatched,
        customersNotFound,
        totalPointsApplied,
      },
    });

    // Create audit log for the sync
    await prisma.auditLog.create({
      data: {
        staffUserId: staffId,
        action: 'gingr_sync',
        entityType: 'gingr_import',
        entityId: gingrImport.id,
        details: {
          invoicesProcessed: invoices.length,
          customersMatched,
          customersNotFound,
          totalPointsApplied,
        },
      },
    });

    return {
      success: true,
      importId: gingrImport.id,
      invoicesProcessed: invoices.length,
      customersMatched,
      customersNotFound,
      totalPointsApplied,
      unmatchedCustomers,
    };
  } catch (error) {
    logger.error('Gingr sync failed:', error);
    return {
      success: false,
      invoicesProcessed: 0,
      customersMatched: 0,
      customersNotFound: 0,
      totalPointsApplied: 0,
      unmatchedCustomers,
      error: error instanceof Error ? error.message : 'Unknown error during sync',
    };
  }
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit: number = 10) {
  return prisma.gingrImport.findMany({
    take: limit,
    orderBy: { syncedAt: 'desc' },
    include: {
      staffUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Fetch animals (pets) for a specific owner from Gingr API
 * Returns empty array if endpoint not available or no animals found
 */
export async function fetchAnimalsForOwner(ownerId: string): Promise<GingrAnimal[]> {
  if (!workingAuthFormat) {
    const test = await testConnection();
    if (!test.connected) {
      logger.warn('Unable to connect to Gingr for animal fetch');
      return [];
    }
  }

  try {
    // Try to fetch animals for this owner
    const url = workingAuthFormat?.useQueryParam
      ? `${GINGR_BASE_URL}/animals?owner_id=${ownerId}&key=${GINGR_API_KEY}`
      : `${GINGR_BASE_URL}/animals?owner_id=${ownerId}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(workingAuthFormat?.getHeaders() || {}),
      },
    });

    if (!response.ok) {
      // If 404, endpoint may not exist - not an error
      if (response.status === 404) {
        logger.info('Gingr /animals endpoint not available');
        return [];
      }
      logger.warn(`Gingr animals endpoint returned ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      error?: boolean;
      data?: Record<string, GingrAnimal> | GingrAnimal[];
      message?: string;
    };

    if (data.error) {
      logger.warn(`Gingr animals error: ${data.message}`);
      return [];
    }

    // Handle both array and object response formats
    const animals = Array.isArray(data.data)
      ? data.data
      : Object.values(data.data || {});

    // Filter to only dogs (species = 'dog' or 'canine')
    return animals.filter(a =>
      !a.species ||
      a.species.toLowerCase() === 'dog' ||
      a.species.toLowerCase() === 'canine'
    );
  } catch (error) {
    logger.warn('Failed to fetch animals from Gingr:', error);
    return [];
  }
}

/**
 * Import dogs for a customer from Gingr
 * Creates dog records linked to the customer
 */
export async function importDogsForCustomer(
  customerId: string,
  gingrOwnerId: string
): Promise<{ imported: number; skipped: number }> {
  try {
    const animals = await fetchAnimalsForOwner(gingrOwnerId);

    if (animals.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;

    for (const animal of animals) {
      // Check if we already have this dog
      const existing = await prisma.dog.findUnique({
        where: { gingrAnimalId: animal.animal_id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the dog record
      await prisma.dog.create({
        data: {
          customerId,
          name: animal.name || 'Unknown',
          breed: animal.breed,
          birthDate: animal.birth_date ? new Date(animal.birth_date) : null,
          gingrAnimalId: animal.animal_id,
        },
      });

      imported++;
    }

    return { imported, skipped };
  } catch (error) {
    logger.error('Failed to import dogs for customer:', error);
    return { imported: 0, skipped: 0 };
  }
}

/**
 * Import visit history for a customer from their invoices
 * Stores GingrVisit records for dashboard display
 */
export async function importVisitsForCustomer(
  customerId: string,
  invoices: GingrInvoice[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    try {
      // Check if we already have this visit
      const existing = await prisma.gingrVisit.findUnique({
        where: { gingrReservationId: invoice.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Determine service type from line items
      const hasGrooming = invoice.line_items?.some(item =>
        item.service_type?.toLowerCase().includes('groom') ||
        item.description?.toLowerCase().includes('groom')
      );
      const hasBoarding = invoice.line_items?.some(item =>
        item.service_type?.toLowerCase().includes('board') ||
        item.description?.toLowerCase().includes('board')
      );

      let serviceType = 'daycare';
      if (hasGrooming) serviceType = 'grooming';
      else if (hasBoarding) serviceType = 'boarding';

      // Build description from line items
      const description = invoice.line_items
        ?.map(item => item.description || item.service_type)
        .filter(Boolean)
        .join(', ');

      // Calculate points earned for this visit
      const { points } = calculatePoints(invoice);

      // Create the visit record
      await prisma.gingrVisit.create({
        data: {
          customerId,
          gingrReservationId: invoice.id,
          visitDate: new Date(invoice.completed_at || invoice.created_at),
          serviceType,
          description: description || null,
          amount: new Prisma.Decimal(invoice.total),
          pointsEarned: points,
        },
      });

      imported++;
    } catch (error) {
      logger.warn(`Failed to import visit ${invoice.id}:`, error);
      skipped++;
    }
  }

  return { imported, skipped };
}

// ============================================
// Customer Import Functions
// ============================================

interface ImportedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pointsBalance: number;
  invoiceCount: number;
}

interface CustomerImportResult {
  success: boolean;
  customersImported: number;
  customersSkipped: number;
  totalPointsApplied: number;
  importedCustomers: ImportedCustomer[];
  skippedCustomers: Array<{
    email?: string;
    phone?: string;
    reason: string;
  }>;
  error?: string;
}

/**
 * Generate unique referral code
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Fetch reservations for import (last 90 days by default)
 * Makes multiple requests since Gingr limits date range to 31 days
 */
async function fetchInvoicesForImport(daysBack: number = 90): Promise<GingrInvoice[]> {
  if (!workingAuthFormat) {
    const test = await testConnection();
    if (!test.connected) {
      throw new Error(test.error || 'Unable to connect to Gingr');
    }
  }

  const allInvoices: GingrInvoice[] = [];
  const seenIds = new Set<string>();

  try {
    // Gingr limits to 31 days per request, so we need to make multiple requests
    const maxDaysPerRequest = 30;
    const now = new Date();

    for (let offset = 0; offset < daysBack; offset += maxDaysPerRequest) {
      const endDate = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      const startDate = new Date(endDate.getTime() - maxDaysPerRequest * 24 * 60 * 60 * 1000);

      logger.info(`Fetching Gingr reservations from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

      const formData = new URLSearchParams();
      formData.append('start_date', startDate.toISOString().split('T')[0]);
      formData.append('end_date', endDate.toISOString().split('T')[0]);
      if (workingAuthFormat?.useQueryParam) {
        formData.append('key', GINGR_API_KEY);
      }

      const response = await fetch(`${GINGR_BASE_URL}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(workingAuthFormat?.getHeaders() || {}),
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`Gingr API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { error: boolean; data?: Record<string, GingrReservation>; message?: string };

      if (data.error) {
        logger.warn(`Gingr API error for date range: ${data.message}`);
        continue;
      }

      // Convert and deduplicate reservations
      const reservations = Object.values(data.data || {});
      for (const reservation of reservations) {
        if (!seenIds.has(reservation.reservation_id)) {
          const total = (reservation.transaction?.price || 0) + (reservation.deposit?.amount || 0);
          if (total > 0) {
            seenIds.add(reservation.reservation_id);
            allInvoices.push(reservationToInvoice(reservation));
          }
        }
      }
    }

    logger.info(`Fetched ${allInvoices.length} unique reservations from Gingr`);
    return allInvoices;
  } catch (error) {
    logger.error('Failed to fetch Gingr reservations for import:', error);
    throw error;
  }
}

/**
 * Import customers from Gingr invoices
 * Creates unclaimed accounts for customers not already in the system
 */
export async function importCustomers(staffId: string, daysBack: number = 90): Promise<CustomerImportResult> {
  const importedCustomers: ImportedCustomer[] = [];
  const skippedCustomers: CustomerImportResult['skippedCustomers'] = [];

  try {
    // Fetch invoices from Gingr
    const invoices = await fetchInvoicesForImport(daysBack);

    if (invoices.length === 0) {
      return {
        success: true,
        customersImported: 0,
        customersSkipped: 0,
        totalPointsApplied: 0,
        importedCustomers: [],
        skippedCustomers: [],
      };
    }

    // Group invoices by customer (using email as primary key, fall back to phone)
    const customerInvoices = new Map<string, {
      ownerName: string;
      ownerId?: string; // Gingr owner ID for fetching pets
      email?: string;
      phone?: string;
      invoices: GingrInvoice[];
    }>();

    for (const invoice of invoices) {
      // Determine unique key (prefer email)
      const email = invoice.owner_email?.toLowerCase().trim();
      const phone = invoice.owner_phone?.replace(/\D/g, '');

      // Skip invoices without contact info
      if (!email && !phone) {
        logger.warn(`Skipping invoice ${invoice.id} - no email or phone`);
        continue;
      }

      const key = email || phone!;

      if (!customerInvoices.has(key)) {
        customerInvoices.set(key, {
          ownerName: invoice.owner_name,
          ownerId: invoice.owner_id,
          email: email,
          phone: phone,
          invoices: [],
        });
      } else if (invoice.owner_id && !customerInvoices.get(key)!.ownerId) {
        // Update owner ID if we have it from a newer invoice
        customerInvoices.get(key)!.ownerId = invoice.owner_id;
      }

      customerInvoices.get(key)!.invoices.push(invoice);
    }

    logger.info(`Found ${customerInvoices.size} unique customers in ${invoices.length} invoices`);

    let totalPointsApplied = 0;

    // Process each unique customer
    for (const [key, data] of customerInvoices) {
      try {
        // Check if customer already exists
        let existingCustomer = null;

        if (data.email) {
          existingCustomer = await prisma.customer.findUnique({
            where: { email: data.email },
            select: { id: true, email: true },
          });
        }

        if (!existingCustomer && data.phone) {
          existingCustomer = await prisma.customer.findFirst({
            where: { phone: { contains: data.phone.slice(-10) } },
            select: { id: true, email: true },
          });
        }

        if (existingCustomer) {
          skippedCustomers.push({
            email: data.email,
            phone: data.phone,
            reason: 'Already registered',
          });
          continue;
        }

        // Parse name
        const nameParts = data.ownerName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || 'Unknown';

        // Require email for account creation
        if (!data.email) {
          skippedCustomers.push({
            phone: data.phone,
            reason: 'No email address - required for account',
          });
          continue;
        }

        // Require phone for account creation
        if (!data.phone || data.phone.length < 10) {
          skippedCustomers.push({
            email: data.email,
            reason: 'No valid phone number - required for account',
          });
          continue;
        }

        // Calculate total points from all invoices
        let customerPoints = 0;
        for (const invoice of data.invoices) {
          const { points } = calculatePoints(invoice);
          customerPoints += points;
        }

        // Cap imported points to prevent immediate large redemptions
        // This gives new imports a head start without breaking the bank
        const IMPORT_POINTS_CAP = 50;
        const uncappedPoints = customerPoints;
        customerPoints = Math.min(customerPoints, IMPORT_POINTS_CAP);

        // Generate unique referral code
        let referralCode = generateReferralCode();
        let attempts = 0;
        while (attempts < 5) {
          const existing = await prisma.customer.findUnique({
            where: { referralCode },
          });
          if (!existing) break;
          referralCode = generateReferralCode();
          attempts++;
        }

        // Create unclaimed customer with points
        const customer = await prisma.$transaction(async (tx) => {
          const newCustomer = await tx.customer.create({
            data: {
              email: data.email!,
              phone: data.phone!,
              firstName,
              lastName,
              referralCode,
              pointsBalance: customerPoints,
              accountStatus: 'unclaimed',
              source: 'gingr_import',
              gingrOwnerId: data.ownerId, // Store Gingr owner ID for pet sync
              // No passwordHash - account is unclaimed
            },
          });

          // Create points transaction for the initial import
          if (customerPoints > 0) {
            const cappedNote = uncappedPoints > IMPORT_POINTS_CAP
              ? ` (capped from ${uncappedPoints})`
              : '';
            await tx.pointsTransaction.create({
              data: {
                customerId: newCustomer.id,
                type: 'purchase',
                amount: customerPoints,
                description: `Imported from Gingr: ${data.invoices.length} invoice(s)${cappedNote}`,
                serviceType: 'daycare', // Default, actual breakdown not tracked
              },
            });
          }

          // Create audit log
          await tx.auditLog.create({
            data: {
              staffUserId: staffId,
              action: 'gingr_import_customer',
              entityType: 'customer',
              entityId: newCustomer.id,
              details: {
                source: 'gingr',
                invoiceCount: data.invoices.length,
                pointsApplied: customerPoints,
              },
            },
          });

          return newCustomer;
        });

        // Import dogs from Gingr if we have the owner ID
        let dogsImported = 0;
        if (data.ownerId) {
          const dogResult = await importDogsForCustomer(customer.id, data.ownerId);
          dogsImported = dogResult.imported;
          if (dogsImported > 0) {
            logger.info(`Imported ${dogsImported} dogs for customer ${customer.email}`);
          }
        }

        // Import visit history from invoices
        const visitResult = await importVisitsForCustomer(customer.id, data.invoices);
        if (visitResult.imported > 0) {
          logger.info(`Imported ${visitResult.imported} visits for customer ${customer.email}`);
        }

        importedCustomers.push({
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          pointsBalance: customer.pointsBalance,
          invoiceCount: data.invoices.length,
        });

        totalPointsApplied += customerPoints;

      } catch (error) {
        logger.error(`Failed to import customer ${key}:`, error);
        skippedCustomers.push({
          email: data.email,
          phone: data.phone,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create audit log for the overall import
    await prisma.auditLog.create({
      data: {
        staffUserId: staffId,
        action: 'gingr_customer_import',
        entityType: 'system',
        entityId: 'gingr_import',
        details: {
          customersImported: importedCustomers.length,
          customersSkipped: skippedCustomers.length,
          totalPointsApplied,
          daysBack,
        },
      },
    });

    return {
      success: true,
      customersImported: importedCustomers.length,
      customersSkipped: skippedCustomers.length,
      totalPointsApplied,
      importedCustomers,
      skippedCustomers,
    };

  } catch (error) {
    logger.error('Gingr customer import failed:', error);
    return {
      success: false,
      customersImported: 0,
      customersSkipped: 0,
      totalPointsApplied: 0,
      importedCustomers: [],
      skippedCustomers: [],
      error: error instanceof Error ? error.message : 'Unknown error during import',
    };
  }
}

/**
 * Get list of unclaimed customers (imported but not yet claimed)
 */
export async function getUnclaimedCustomers(limit: number = 50) {
  return prisma.customer.findMany({
    where: {
      accountStatus: 'unclaimed',
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      pointsBalance: true,
      source: true,
      createdAt: true,
    },
  });
}
