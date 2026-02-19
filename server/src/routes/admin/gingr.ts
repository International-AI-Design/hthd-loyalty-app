import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { testConnection, syncInvoices, getSyncHistory, importCustomers, getUnclaimedCustomers, fullImport, populateDashboard } from '../../services/gingr';
import { getAutoSyncStatus } from '../../jobs/gingrSync';

const router = Router();

// Apply staff authentication + restrict Gingr admin to owner/manager/admin
router.use(authenticateStaff);
router.use(requireRole('owner', 'manager', 'admin'));

// GET /api/admin/gingr/status
// Check Gingr API connection status and auto-sync status
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const connectionResult = await testConnection();
    const autoSyncStatus = getAutoSyncStatus();

    res.status(200).json({
      connected: connectionResult.connected,
      auth_format: connectionResult.authFormat,
      error: connectionResult.error,
      subdomain: process.env.GINGR_SUBDOMAIN || 'not configured',
      auto_sync: {
        enabled: autoSyncStatus.enabled,
        last_sync_time: autoSyncStatus.lastSyncTime?.toISOString() || null,
        sync_in_progress: autoSyncStatus.syncInProgress,
        interval_minutes: autoSyncStatus.intervalMinutes,
        business_hours: {
          start: autoSyncStatus.businessHours.start,
          end: autoSyncStatus.businessHours.end,
        },
      },
    });
  } catch (error) {
    console.error('Gingr status check error:', error);
    res.status(500).json({
      connected: false,
      error: 'Failed to check Gingr connection status',
    });
  }
});

// POST /api/admin/gingr/sync
// Trigger sync from Gingr
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const staffId = staffReq.staff.id;

    const result = await syncInvoices(staffId);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(200).json({
      success: true,
      import_id: result.importId,
      invoices_processed: result.invoicesProcessed,
      customers_matched: result.customersMatched,
      customers_not_found: result.customersNotFound,
      total_points_applied: result.totalPointsApplied,
      unmatched_customers: result.unmatchedCustomers.map(c => ({
        owner_name: c.ownerName,
        invoice_id: c.invoiceId,
        total: c.total,
      })),
    });
  } catch (error) {
    console.error('Gingr sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sync',
    });
  }
});

// GET /api/admin/gingr/history
// Get sync history
router.get('/history', async (_req: Request, res: Response): Promise<void> => {
  try {
    const history = await getSyncHistory(20);

    res.status(200).json({
      history: history.map(h => ({
        id: h.id,
        synced_at: h.syncedAt,
        invoices_processed: h.invoicesProcessed,
        customers_matched: h.customersMatched,
        customers_not_found: h.customersNotFound,
        total_points_applied: h.totalPointsApplied,
        synced_by: `${h.staffUser.firstName} ${h.staffUser.lastName}`,
      })),
    });
  } catch (error) {
    console.error('Gingr history error:', error);
    res.status(500).json({
      error: 'Failed to fetch sync history',
    });
  }
});

// POST /api/admin/gingr/import-customers
// Import customers from Gingr invoices (creates unclaimed accounts)
router.post('/import-customers', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const staffId = staffReq.staff.id;

    // Optional: days_back parameter (default 90)
    const daysBack = parseInt(req.body.days_back) || 90;

    const result = await importCustomers(staffId, daysBack);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(200).json({
      success: true,
      customers_imported: result.customersImported,
      customers_skipped: result.customersSkipped,
      total_points_applied: result.totalPointsApplied,
      imported_customers: result.importedCustomers.map(c => ({
        id: c.id,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        points_balance: c.pointsBalance,
        invoice_count: c.invoiceCount,
      })),
      skipped_customers: result.skippedCustomers.map(c => ({
        email: c.email,
        phone: c.phone,
        reason: c.reason,
      })),
    });
  } catch (error) {
    console.error('Gingr import customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during import',
    });
  }
});

// POST /api/admin/gingr/full-import
// Pull ALL data from Gingr: owners, reservations (2yr), dogs, visits, points
// Makes the app feel live with real business data
router.post('/full-import', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const staffId = staffReq.staff.id;

    const result = await fullImport(staffId);

    res.status(200).json({
      success: result.success,
      owners_found: result.ownersFound,
      customers_created: result.customersCreated,
      customers_skipped: result.customersSkipped,
      invoices_processed: result.invoicesProcessed,
      dogs_imported: result.dogsImported,
      visits_imported: result.visitsImported,
      total_points_applied: result.totalPointsApplied,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Gingr full import error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during full import',
    });
  }
});

// POST /api/admin/gingr/populate-dashboard
// Populate admin dashboard: import dogs, create bookings from upcoming reservations, generate staff schedules
router.post('/populate-dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const staffId = staffReq.staff.id;

    const result = await populateDashboard(staffId);

    res.status(200).json({
      success: result.success,
      dogs_imported: result.dogsImported,
      bookings_created: result.bookingsCreated,
      staff_schedules_created: result.staffSchedulesCreated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Populate dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during dashboard population',
    });
  }
});

// GET /api/admin/gingr/unclaimed-customers
// Get list of unclaimed (imported but not yet claimed) customers
router.get('/unclaimed-customers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const customers = await getUnclaimedCustomers(100);

    res.status(200).json({
      customers: customers.map(c => ({
        id: c.id,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        points_balance: c.pointsBalance,
        source: c.source,
        created_at: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('Gingr unclaimed customers error:', error);
    res.status(500).json({
      error: 'Failed to fetch unclaimed customers',
    });
  }
});

export default router;
