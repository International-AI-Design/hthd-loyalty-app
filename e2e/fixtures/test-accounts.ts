/**
 * Test account credentials for E2E tests.
 *
 * These are permanent QA accounts in the production database.
 * Tests can send messages and navigate freely (harmless).
 * Tests NEVER create bookings, redeem points, or modify real customer data.
 */

export const TEST_CUSTOMER = {
  email: process.env.TEST_CUSTOMER_EMAIL || 'qa-test@internationalaidesign.com',
  password: process.env.TEST_CUSTOMER_PASSWORD || '',
  name: 'QA Testdog',
  dogs: ['Playwright', 'Cypress'],
};

export const TEST_STAFF = {
  username: process.env.TEST_STAFF_USERNAME || 'qa-staff',
  password: process.env.TEST_STAFF_PASSWORD || '',
  role: 'manager',
};
