import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateTestToken, hasTestDatabase } from '../../test/setup';
import { createTestStaff, cleanupTestData } from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('Admin Messaging Router — /api/v2/admin/messaging', () => {
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
    const res = await request(app).get('/api/v2/admin/messaging/conversations');
    expect(res.status).toBe(401);
  });

  // ── GET /conversations ────────────────────────────────────────────────

  it('GET /conversations returns 200 with conversations array', async () => {
    const res = await request(app)
      .get('/api/v2/admin/messaging/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });

  // ── GET /conversations/:id ────────────────────────────────────────────

  it('GET /conversations/:id returns 404 for non-existent conversation', async () => {
    const res = await request(app)
      .get('/api/v2/admin/messaging/conversations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  // ── POST /conversations/:id/assign ────────────────────────────────────

  it('POST /conversations/:id/assign returns 404 for non-existent conversation', async () => {
    const res = await request(app)
      .post('/api/v2/admin/messaging/conversations/00000000-0000-0000-0000-000000000000/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  // ── POST /conversations/:id/escalate ──────────────────────────────────

  it('POST /conversations/:id/escalate returns 404 for non-existent conversation', async () => {
    const res = await request(app)
      .post('/api/v2/admin/messaging/conversations/00000000-0000-0000-0000-000000000000/escalate')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  // ── POST /conversations/:id/de-escalate ───────────────────────────────

  it('POST /conversations/:id/de-escalate returns 404 for non-existent conversation', async () => {
    const res = await request(app)
      .post('/api/v2/admin/messaging/conversations/00000000-0000-0000-0000-000000000000/de-escalate')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });
});
