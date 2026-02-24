import '../../test/bootstrap';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, generateCustomerTestToken, hasTestDatabase } from '../../test/setup';
import { createTestCustomer, cleanupTestData, prisma } from '../../test/fixtures';
import type { Express } from 'express';

const canRun = hasTestDatabase();

describe.skipIf(!canRun)('Customer Messaging API Contract — /api/v2/messaging', () => {
  let app: Express;
  let customerToken: string;
  let customerId: string;
  let conversationId: string;

  beforeAll(async () => {
    app = createTestApp();

    // Create a real customer in the DB so authenticateCustomer middleware passes
    const customer = await createTestCustomer();
    customerId = customer.id;
    customerToken = generateCustomerTestToken({ id: customer.id, email: customer.email });

    // Create a conversation for this customer
    const conversation = await (prisma as any).conversation.create({
      data: {
        customerId: customer.id,
        channel: 'web_chat',
        status: 'active',
      },
    });
    conversationId = conversation.id;

    // Bulk-insert 65 messages into the conversation so we can test limit behaviour
    const messageData = Array.from({ length: 65 }, (_, i) => ({
      conversationId: conversation.id,
      role: i % 2 === 0 ? 'customer' : 'assistant',
      content: `Test message number ${i + 1}`,
      channel: 'web_chat',
    }));
    await (prisma as any).message.createMany({ data: messageData });
  });

  afterAll(async () => {
    // Conversation and messages cascade-delete with the customer
    await cleanupTestData([], [customerId]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/v2/messaging/conversations');
    expect(res.status).toBe(401);
  });

  it('returns 401 when a staff token is used on customer routes', async () => {
    // Staff tokens have type: 'staff' — customer middleware rejects them
    const { generateTestToken } = await import('../../test/setup');
    const { createTestStaff } = await import('../../test/fixtures');
    const staff = await createTestStaff();
    const staffToken = generateTestToken({ id: staff.id, username: staff.username, role: staff.role });

    const res = await request(app)
      .get('/api/v2/messaging/conversations')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(401);

    // Clean up the staff user
    await cleanupTestData([staff.id], []);
  });

  // ── GET /conversations ────────────────────────────────────────────────

  it('GET /conversations returns conversations array', async () => {
    const res = await request(app)
      .get('/api/v2/messaging/conversations')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.conversations.length).toBeGreaterThanOrEqual(1);

    // Verify conversation shape matches frontend expectations
    const conv = res.body.conversations[0];
    expect(conv).toHaveProperty('id');
    expect(conv).toHaveProperty('channel');
    expect(conv).toHaveProperty('status');
    expect(conv).toHaveProperty('lastMessageAt');
    expect(conv).toHaveProperty('messageCount');
    expect(conv).toHaveProperty('createdAt');
  });

  // ── ConversationFilterSchema — query params ───────────────────────────

  it('GET /conversations?status=active accepts valid filter', async () => {
    const res = await request(app)
      .get('/api/v2/messaging/conversations?status=active')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
    // All returned conversations should be active
    for (const conv of res.body.conversations) {
      expect(conv.status).toBe('active');
    }
  });

  it('GET /conversations silently ignores invalid filter values (no 400)', async () => {
    // ConversationFilterSchema uses safeParse — invalid values fall through to no filter
    const res = await request(app)
      .get('/api/v2/messaging/conversations?status=bogus')
      .set('Authorization', `Bearer ${customerToken}`);

    // Router uses safeParse and falls back to undefined filter, so this returns 200
    expect(res.status).toBe(200);
  });

  // ── GET /conversations/:id/messages — pagination & shape ──────────────

  it('limit=500 returns all 65 messages', async () => {
    const res = await request(app)
      .get(`/api/v2/messaging/conversations/${conversationId}/messages?limit=500`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('messages');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('offset');

    // All 65 messages should be returned when limit is 500
    expect(res.body.messages.length).toBe(65);
    expect(res.body.total).toBe(65);
    expect(res.body.limit).toBe(500);
  });

  it('response shape matches frontend expectations (messages array with id, role, content, createdAt)', async () => {
    const res = await request(app)
      .get(`/api/v2/messaging/conversations/${conversationId}/messages?limit=5`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBeGreaterThanOrEqual(1);

    // Each message must have the fields the frontend depends on
    for (const msg of res.body.messages) {
      expect(msg).toHaveProperty('id');
      expect(typeof msg.id).toBe('string');
      expect(msg).toHaveProperty('role');
      expect(['customer', 'assistant', 'system']).toContain(msg.role);
      expect(msg).toHaveProperty('content');
      expect(typeof msg.content).toBe('string');
      expect(msg).toHaveProperty('createdAt');
      // createdAt must be parseable as a date
      expect(new Date(msg.createdAt).getTime()).not.toBeNaN();
    }
  });

  it('default limit does not silently cap — returns up to 50 messages', async () => {
    const res = await request(app)
      .get(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    // Default limit is 50, we have 65 messages, so should get exactly 50
    expect(res.body.messages.length).toBe(50);
    expect(res.body.limit).toBe(50);
    expect(res.body.total).toBe(65);
  });

  it('offset pagination works correctly', async () => {
    const res = await request(app)
      .get(`/api/v2/messaging/conversations/${conversationId}/messages?limit=50&offset=50`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    // 65 total minus 50 offset = 15 remaining
    expect(res.body.messages.length).toBe(15);
    expect(res.body.offset).toBe(50);
    expect(res.body.total).toBe(65);
  });

  // ── POST /conversations/:id/messages — SendMessageSchema ─────────────

  it('SendMessageSchema accepts valid content (201)', async () => {
    const res = await request(app)
      .post(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: 'Hello, I have a question about my booking.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('customerMessage');
    expect(res.body.customerMessage).toHaveProperty('id');
    expect(res.body.customerMessage).toHaveProperty('content');
  });

  it('SendMessageSchema accepts content up to 2000 chars (201)', async () => {
    const longContent = 'A'.repeat(2000);

    const res = await request(app)
      .post(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: longContent });

    expect(res.status).toBe(201);
  });

  it('SendMessageSchema rejects empty content (400)', async () => {
    const res = await request(app)
      .post(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('SendMessageSchema rejects content exceeding 2000 chars (400)', async () => {
    const overLimitContent = 'A'.repeat(2001);

    const res = await request(app)
      .post(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ content: overLimitContent });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('SendMessageSchema rejects missing content field (400)', async () => {
    const res = await request(app)
      .post(`/api/v2/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ── Conversation not found / wrong customer ───────────────────────────

  it('returns 404 for non-existent conversation', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .get(`/api/v2/messaging/conversations/${fakeId}/messages`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
  });
});
