import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const CUSTOMER_APP_URL = process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com';
const ADMIN_APP_URL = process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run sequentially — tests share production state
  forbidOnly: true,
  retries: 1,
  workers: 1,
  outputDir: '../test-results/artifacts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../test-results/report' }],
  ],
  timeout: 90_000, // 90s per test — AI responses can be slow
  expect: {
    timeout: 15_000,
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'customer-desktop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: CUSTOMER_APP_URL,
      },
      testMatch: /customer\/(?!mobile).+\.spec\.ts/,
    },
    {
      name: 'customer-mobile',
      use: {
        ...devices['iPhone 14'],
        baseURL: CUSTOMER_APP_URL,
      },
      testMatch: /customer\/mobile\.spec\.ts/,
    },
    {
      name: 'admin-desktop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ADMIN_APP_URL,
      },
      testMatch: /admin\/.+\.spec\.ts/,
    },
    {
      name: 'admin-mobile',
      use: {
        ...devices['iPhone 14'],
        baseURL: ADMIN_APP_URL,
      },
      testMatch: /admin\/navigation\.spec\.ts/,
    },
    {
      name: 'functional-audit',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /shared\/functional-audit\.spec\.ts/,
    },
  ],
});
