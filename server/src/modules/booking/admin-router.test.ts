import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateTestToken, hasTestDatabase, TEST_STAFF } from '../../test/setup';
import {
  createTestStaff,
  createTestCustomer,
  createTestDog,
  createTestBooking,
  getOrCreateServiceType,
  cleanupTestData,
} from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('Admin Booking Router — /api/v2/admin/bookings', () => {
  let app: Express;
  let token: string;
  let staffId: string;
  let customerId: string;
  let serviceTypeId: string;

  beforeAll(async () => {
    app = createTestApp();

    // Seed a real staff user so authenticateStaff DB lookup passes
    const staff = await createTestStaff({ role: 'admin' });
    staffId = staff.id;
    token = generateTestToken({ id: staff.id, username: staff.username, role: staff.role });

    // Seed supporting data
    const customer = await createTestCustomer();
    customerId = customer.id;

    const serviceType = await getOrCreateServiceType('daycare');
    serviceTypeId = serviceType.id;
  });

  afterAll(async () => {
    await cleanupTestData([staffId], [customerId]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/v2/admin/bookings/service-types');
    expect(res.status).toBe(401);
  });

  // ── GET /service-types ────────────────────────────────────────────────

  it('GET /service-types returns 200 with serviceTypes array', async () => {
    const res = await request(app)
      .get('/api/v2/admin/bookings/service-types')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('serviceTypes');
    expect(Array.isArray(res.body.serviceTypes)).toBe(true);
  });

  // ── GET /schedule ─────────────────────────────────────────────────────

  it('GET /schedule returns 200 with bookings array and total', async () => {
    const res = await request(app)
      .get('/api/v2/admin/bookings/schedule?date=2026-02-23')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bookings');
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  // ── GET /availability ─────────────────────────────────────────────────

  it('GET /availability returns 200 with availability array', async () => {
    const res = await request(app)
      .get(`/api/v2/admin/bookings/availability?serviceTypeId=${serviceTypeId}&startDate=2026-02-23&endDate=2026-02-24`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('availability');
    expect(Array.isArray(res.body.availability)).toBe(true);
  });

  // ── POST /:id/check-in ───────────────────────────────────────────────

  it('POST /:id/check-in returns 404 for non-existent booking', async () => {
    const res = await request(app)
      .post('/api/v2/admin/bookings/00000000-0000-0000-0000-000000000000/check-in')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  // ── POST /:id/check-out ──────────────────────────────────────────────

  it('POST /:id/check-out returns 404 for non-existent booking', async () => {
    const res = await request(app)
      .post('/api/v2/admin/bookings/00000000-0000-0000-0000-000000000000/check-out')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });
});
