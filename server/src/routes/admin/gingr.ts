import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { testConnection, syncInvoices, getSyncHistory } from '../../services/gingr';

const router = Router();

// Apply staff authentication to all routes
router.use(authenticateStaff);

// GET /api/admin/gingr/status
// Check Gingr API connection status
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await testConnection();

    res.status(200).json({
      connected: result.connected,
      auth_format: result.authFormat,
      error: result.error,
      subdomain: process.env.GINGR_SUBDOMAIN || 'not configured',
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

export default router;
