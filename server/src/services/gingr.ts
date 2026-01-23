import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
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

interface GingrInvoice {
  id: string;
  invoice_number: string;
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
 * Fetch invoices from Gingr API
 */
async function fetchInvoices(since?: Date): Promise<GingrInvoice[]> {
  if (!workingAuthFormat) {
    const test = await testConnection();
    if (!test.connected) {
      throw new Error(test.error || 'Unable to connect to Gingr');
    }
  }

  try {
    let url = `${GINGR_BASE_URL}/invoices?status=completed&limit=100`;
    if (since) {
      url += `&created_after=${since.toISOString()}`;
    }
    if (workingAuthFormat?.useQueryParam) {
      url += `&key=${GINGR_API_KEY}`;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(workingAuthFormat?.getHeaders() || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gingr API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.invoices || data || [];
  } catch (error) {
    logger.error('Failed to fetch Gingr invoices:', error);
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

          // Add points to customer
          await tx.customer.update({
            where: { id: customerId },
            data: {
              pointsBalance: { increment: points },
            },
          });

          // Create points transaction
          await tx.pointsTransaction.create({
            data: {
              customerId,
              type: 'purchase',
              amount: points,
              description: `Gingr sync: Invoice ${invoice.invoice_number || invoice.id}${hasGrooming ? ' (1.5x grooming bonus)' : ''}`,
              serviceType: hasGrooming ? 'grooming' : 'daycare',
              dollarAmount: new Prisma.Decimal(invoice.total),
            },
          });

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
                pointsApplied: points,
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
 * Fetch invoices for import (last 90 days by default)
 */
async function fetchInvoicesForImport(daysBack: number = 90): Promise<GingrInvoice[]> {
  if (!workingAuthFormat) {
    const test = await testConnection();
    if (!test.connected) {
      throw new Error(test.error || 'Unable to connect to Gingr');
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  try {
    let url = `${GINGR_BASE_URL}/invoices?status=completed&limit=500&created_after=${since.toISOString()}`;
    if (workingAuthFormat?.useQueryParam) {
      url += `&key=${GINGR_API_KEY}`;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(workingAuthFormat?.getHeaders() || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gingr API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.invoices || data || [];
  } catch (error) {
    logger.error('Failed to fetch Gingr invoices for import:', error);
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
          email: email,
          phone: phone,
          invoices: [],
        });
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
