import { Router, Request, Response } from 'express';
import { authenticateStaff } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { StaffScheduleService, ScheduleError } from './service';
import {
  ScheduleCreateSchema,
  ScheduleUpdateSchema,
  ScheduleBulkCreateSchema,
  WeekViewParamsSchema,
  BreakCreateSchema,
} from './types';

const router = Router();
const scheduleService = new StaffScheduleService();

// All admin schedule routes require staff authentication
router.use(authenticateStaff);

// GET / — get schedules by date
router.get('/', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format' });
      return;
    }

    const schedules = await scheduleService.getSchedulesByDate(date);
    res.json({ schedules, total: schedules.length });
  } catch (error) {
    console.error('Get schedules by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /week — week view grid
router.get('/week', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = WeekViewParamsSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const weekGrid = await scheduleService.getWeekView(validation.data.startDate);
    res.json({ week: weekGrid });
  } catch (error) {
    console.error('Get week view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /staff/:staffUserId — individual staff schedule
router.get('/staff/:staffUserId', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const staffUserId = req.params.staffUserId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({ error: 'startDate and endDate query parameters are required in YYYY-MM-DD format' });
      return;
    }

    const schedules = await scheduleService.getStaffSchedule(staffUserId, startDate, endDate);
    res.json({ schedules, total: schedules.length });
  } catch (error) {
    console.error('Get staff schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /coverage — staff-to-dog coverage ratio for a date
router.get('/coverage', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format' });
      return;
    }

    const coverage = await scheduleService.getStaffCoverage(date);
    res.json({ coverage });
  } catch (error) {
    console.error('Get staff coverage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /available — active staff not scheduled for a date
router.get('/available', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format' });
      return;
    }

    const staff = await scheduleService.getAvailableStaff(date);
    res.json({ staff, total: staff.length });
  } catch (error) {
    console.error('Get available staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create a single schedule entry
router.post('/', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ScheduleCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const schedule = await scheduleService.createSchedule(validation.data);
    res.status(201).json({ schedule });
  } catch (error: any) {
    // Handle Prisma unique constraint violation
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Staff member already has a schedule for this date' });
      return;
    }
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bulk — bulk create schedule entries
router.post('/bulk', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = ScheduleBulkCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const schedules = await scheduleService.bulkCreateSchedules(validation.data.schedules);
    res.status(201).json({ schedules, total: schedules.length });
  } catch (error) {
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Bulk create schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update a schedule entry
router.put('/:id', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = ScheduleUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const schedule = await scheduleService.updateSchedule(id, validation.data);
    res.json({ schedule });
  } catch (error) {
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — delete a schedule entry
router.delete('/:id', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await scheduleService.deleteSchedule(id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Staff Break Routes ──

// POST /:scheduleId/breaks — add a break to a schedule entry
router.post('/:scheduleId/breaks', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const validation = BreakCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const breakEntry = await scheduleService.addBreak(scheduleId, validation.data);
    res.status(201).json({ break: breakEntry });
  } catch (error) {
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Add break error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /breaks/:breakId — remove a break
router.delete('/breaks/:breakId', requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const breakId = req.params.breakId as string;
    await scheduleService.removeBreak(breakId);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ScheduleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Remove break error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
