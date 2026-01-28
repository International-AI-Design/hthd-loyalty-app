import { prisma } from '../lib/prisma';
import { syncInvoices } from '../services/gingr';
import { logger } from '../middleware/security';

// Configuration from environment
const AUTO_SYNC_ENABLED = process.env.GINGR_AUTO_SYNC_ENABLED === 'true';
const SYNC_INTERVAL_MINUTES = parseInt(process.env.GINGR_AUTO_SYNC_INTERVAL || '30', 10);
const BUSINESS_HOURS_START = 7; // 7 AM
const BUSINESS_HOURS_END = 20; // 8 PM

// System user ID for auto-sync audit trail
// This will be created or found at startup
let systemStaffId: string | null = null;

// Track last sync time
let lastSyncTime: Date | null = null;
let syncInProgress = false;

/**
 * Get or create the system staff user for auto-sync operations
 */
async function getOrCreateSystemStaff(): Promise<string> {
  const systemUsername = 'system-auto-sync';

  // Try to find existing system user
  const existing = await prisma.staffUser.findUnique({
    where: { username: systemUsername },
  });

  if (existing) {
    return existing.id;
  }

  // Create system user (no password - cannot login)
  const systemUser = await prisma.staffUser.create({
    data: {
      username: systemUsername,
      passwordHash: '', // Cannot login - hash doesn't match anything
      role: 'system',
      firstName: 'System',
      lastName: 'Auto-Sync',
      isActive: true,
    },
  });

  logger.info('Created system auto-sync staff user');
  return systemUser.id;
}

/**
 * Check if we're within business hours
 */
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

/**
 * Run the Gingr sync
 */
async function runSync(): Promise<void> {
  if (syncInProgress) {
    logger.info('Gingr auto-sync: Already in progress, skipping');
    return;
  }

  if (!isWithinBusinessHours()) {
    logger.debug('Gingr auto-sync: Outside business hours, skipping');
    return;
  }

  if (!systemStaffId) {
    logger.warn('Gingr auto-sync: System staff ID not initialized');
    return;
  }

  syncInProgress = true;
  logger.info('Gingr auto-sync: Starting scheduled sync');

  try {
    const result = await syncInvoices(systemStaffId);

    if (result.success) {
      lastSyncTime = new Date();
      logger.info('Gingr auto-sync: Completed', {
        invoicesProcessed: result.invoicesProcessed,
        customersMatched: result.customersMatched,
        customersNotFound: result.customersNotFound,
        totalPointsApplied: result.totalPointsApplied,
      });
    } else {
      logger.error('Gingr auto-sync: Failed', { error: result.error });
    }
  } catch (error) {
    logger.error('Gingr auto-sync: Error during sync', { error });
  } finally {
    syncInProgress = false;
  }
}

/**
 * Start the auto-sync job using setInterval
 * Uses native setInterval instead of node-cron for simplicity
 */
export async function startGingrAutoSync(): Promise<void> {
  if (!AUTO_SYNC_ENABLED) {
    logger.info('Gingr auto-sync: Disabled (set GINGR_AUTO_SYNC_ENABLED=true to enable)');
    return;
  }

  try {
    // Initialize system staff user
    systemStaffId = await getOrCreateSystemStaff();
    logger.info('Gingr auto-sync: Initialized with system staff ID');

    // Calculate interval in milliseconds
    const intervalMs = SYNC_INTERVAL_MINUTES * 60 * 1000;

    // Start the interval
    setInterval(runSync, intervalMs);

    logger.info(`Gingr auto-sync: Started (every ${SYNC_INTERVAL_MINUTES} minutes during business hours ${BUSINESS_HOURS_START}:00-${BUSINESS_HOURS_END}:00)`);

    // Run an initial sync after a short delay
    setTimeout(runSync, 5000);
  } catch (error) {
    logger.error('Gingr auto-sync: Failed to start', { error });
  }
}

/**
 * Get the last sync status for admin UI
 */
export function getAutoSyncStatus(): {
  enabled: boolean;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
  intervalMinutes: number;
  businessHours: { start: number; end: number };
} {
  return {
    enabled: AUTO_SYNC_ENABLED,
    lastSyncTime,
    syncInProgress,
    intervalMinutes: SYNC_INTERVAL_MINUTES,
    businessHours: { start: BUSINESS_HOURS_START, end: BUSINESS_HOURS_END },
  };
}
