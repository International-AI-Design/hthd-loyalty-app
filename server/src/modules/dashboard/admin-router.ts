import { Router, Request, Response } from 'express';
import { authenticateStaff } from '../../middleware/auth';
import { DashboardService } from './service';
import { DashboardParamsSchema, DateRangeParamsSchema } from './types';

const router = Router();
const dashboardService = new DashboardService();

// All dashboard routes require staff authentication
router.use(authenticateStaff);

// GET / — full dashboard summary
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = DashboardParamsSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const dateStr = validation.data.date || new Date().toISOString().split('T')[0];
    const summary = await dashboardService.getDashboardSummary(dateStr);
    res.json(summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /facility — facility status only
router.get('/facility', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const facility = await dashboardService.getFacilityStatus(dateStr);
    res.json(facility);
  } catch (error) {
    console.error('Facility status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /arrivals-departures — arrivals and departures
router.get('/arrivals-departures', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await dashboardService.getArrivalsAndDepartures(dateStr);
    res.json(data);
  } catch (error) {
    console.error('Arrivals/departures error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /staff — staff on duty
router.get('/staff', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await dashboardService.getStaffOnDuty(dateStr);
    res.json(data);
  } catch (error) {
    console.error('Staff on duty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /facility-details — dog-level breakdown for a specific service
router.get('/facility-details', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const service = req.query.service as string;

    if (!service || !['daycare', 'boarding', 'grooming'].includes(service)) {
      res.status(400).json({ error: 'service must be one of: daycare, boarding, grooming' });
      return;
    }

    const data = await dashboardService.getFacilityDetails(dateStr, service as 'daycare' | 'boarding' | 'grooming');
    res.json(data);
  } catch (error) {
    console.error('Facility details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /compliance — compliance flags
router.get('/compliance', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await dashboardService.getComplianceFlags();
    res.json(data);
  } catch (error) {
    console.error('Compliance flags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /weekly — weekly overview
router.get('/weekly', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = DateRangeParamsSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const data = await dashboardService.getWeeklyOverview(validation.data.startDate);
    res.json(data);
  } catch (error) {
    console.error('Weekly overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
