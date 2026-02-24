import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateCustomerTestToken, hasTestDatabase } from '../../test/setup';
import {
  createTestCustomer,
  createTestDog,
  getOrCreateServiceType,
  cleanupTestData,
} from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('Customer Booking API Contract — /api/v2/bookings', () => {
  let app: Express;
  let customerToken: string;
  let customerId: string;
  let serviceTypeId: string;

  beforeAll(async () => {
    app = createTestApp();

    // Create a real customer so authenticateCustomer middleware passes
    const customer = await createTestCustomer();
    customerId = customer.id;
    customerToken = generateCustomerTestToken({ id: customer.id, email: customer.email });

    // Ensure a service type exists for creation tests
    const serviceType = await getOrCreateServiceType('daycare');
    serviceTypeId = serviceType.id;
  });

  afterAll(async () => {
    await cleanupTestData([], [customerId]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/v2/bookings');
    expect(res.status).toBe(401);
  });

  // ── GET / — list my bookings ──────────────────────────────────────────

  it('GET / returns bookings array and total (even when empty)', async () => {
    const res = await request(app)
      .get('/api/v2/bookings')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bookings');
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
  });

  // ── GET /service-types ────────────────────────────────────────────────

  it('GET /service-types returns serviceTypes array', async () => {
    const res = await request(app)
      .get('/api/v2/bookings/service-types')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('serviceTypes');
    expect(Array.isArray(res.body.serviceTypes)).toBe(true);
  });

  // ── GET /availability ─────────────────────────────────────────────────

  it('GET /availability validates required fields (400 without params)', async () => {
    const res = await request(app)
      .get('/api/v2/bookings/availability')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /availability returns availability array with valid params', async () => {
    const res = await request(app)
      .get(`/api/v2/bookings/availability?serviceTypeId=${serviceTypeId}&startDate=2026-03-01&endDate=2026-03-02`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('availability');
    expect(Array.isArray(res.body.availability)).toBe(true);
  });

  // ── POST / — create booking validation ────────────────────────────────

  it('POST / rejects empty body (400)', async () => {
    const res = await request(app)
      .post('/api/v2/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST / rejects missing dogIds (400)', async () => {
    const res = await request(app)
      .post('/api/v2/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceTypeId,
        date: '2026-04-01',
        // dogIds intentionally omitted
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST / rejects invalid date format (400)', async () => {
    const res = await request(app)
      .post('/api/v2/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceTypeId,
        dogIds: ['00000000-0000-0000-0000-000000000000'],
        date: 'not-a-date',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ── POST /:id/cancel — validation ─────────────────────────────────────

  it('POST /:id/cancel returns 404 for non-existent booking', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .post(`/api/v2/bookings/${fakeId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    // The cancel route tries to find the booking; should return an error
    expect([400, 404]).toContain(res.status);
  });

  // ── GET /grooming-slots ───────────────────────────────────────────────

  it('GET /grooming-slots validates date param (400 without date)', async () => {
    const res = await request(app)
      .get('/api/v2/bookings/grooming-slots')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /grooming-slots returns slots array for valid date', async () => {
    const res = await request(app)
      .get('/api/v2/bookings/grooming-slots?date=2026-03-15')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slots');
    expect(Array.isArray(res.body.slots)).toBe(true);
  });
});
