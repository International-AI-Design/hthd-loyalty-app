import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateTestToken, hasTestDatabase } from '../../test/setup';
import { createTestStaff, cleanupTestData } from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('Admin Dashboard Router — /api/v2/admin/dashboard', () => {
  let app: Express;
  let token: string;
  let staffId: string;

  beforeAll(async () => {
    app = createTestApp();

    const staff = await createTestStaff({ role: 'admin' });
    staffId = staff.id;
    token = generateTestToken({ id: staff.id, username: staff.username, role: staff.role });
  });

  afterAll(async () => {
    await cleanupTestData([staffId], []);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/v2/admin/dashboard');
    expect(res.status).toBe(401);
  });

  // ── GET / ─────────────────────────────────────────────────────────────

  it('GET / returns 200', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /facility ─────────────────────────────────────────────────────

  it('GET /facility returns 200', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/facility')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /arrivals-departures ──────────────────────────────────────────

  it('GET /arrivals-departures returns 200', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/arrivals-departures')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /staff ────────────────────────────────────────────────────────

  it('GET /staff returns 200', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/staff')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /compliance ───────────────────────────────────────────────────

  it('GET /compliance returns 200', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/compliance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /facility-details ─────────────────────────────────────────────

  it('GET /facility-details returns 200 with valid params', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/facility-details?date=2026-02-23&service=daycare')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // ── GET /weekly ───────────────────────────────────────────────────────

  it('GET /weekly returns 200 with startDate param', async () => {
    const res = await request(app)
      .get('/api/v2/admin/dashboard/weekly?startDate=2026-02-23')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
