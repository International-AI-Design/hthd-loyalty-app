import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateTestToken, hasTestDatabase } from '../../test/setup';
import { createTestStaff, cleanupTestData } from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('AIM Router — /api/v2/admin/aim', () => {
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
    const res = await request(app).post('/api/v2/admin/aim/chat').send({ message: 'test' });
    expect(res.status).toBe(401);
  });

  // ── POST /chat ────────────────────────────────────────────────────────

  it('POST /chat with message is NOT 404 (route exists)', async () => {
    const res = await request(app)
      .post('/api/v2/admin/aim/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'test' });

    // Route exists — 200 if OPENAI_API_KEY set, 500 if not, never 404
    expect(res.status).not.toBe(404);
    expect([200, 500]).toContain(res.status);
  });

  // ── GET /conversations ────────────────────────────────────────────────

  it('GET /conversations returns 200 with conversations array', async () => {
    const res = await request(app)
      .get('/api/v2/admin/aim/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });

  // ── GET /alerts ───────────────────────────────────────────────────────

  it('GET /alerts returns 200 with alerts array', async () => {
    const res = await request(app)
      .get('/api/v2/admin/aim/alerts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('alerts');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });
});
