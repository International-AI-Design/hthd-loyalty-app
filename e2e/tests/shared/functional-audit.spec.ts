import { test, expect } from '@playwright/test';
import { loginAsCustomer, loginAsStaff } from '../../fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

// ---------- Load registries (fail gracefully if not yet generated) ----------

interface RegistryElement {
  name: string;
  selector: string;
  action: string;
  expected: string;
  test: string;
  critical?: boolean;
}

interface RegistryRoute {
  page: string;
  auth: string;
  description: string;
  elements: RegistryElement[];
  states?: Record<string, {
    description: string;
    elements: RegistryElement[];
  }>;
}

interface FeatureRegistry {
  app: string;
  routes: Record<string, RegistryRoute>;
}

function loadRegistry(filename: string): FeatureRegistry | null {
  const filePath = path.resolve(__dirname, '../../registry', filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getAllElements(route: RegistryRoute): RegistryElement[] {
  const elements = [...(route.elements || [])];
  if (route.states) {
    for (const state of Object.values(route.states)) {
      elements.push(...(state.elements || []));
    }
  }
  // Only test clickable elements (skip type-only inputs and assert-visible)
  return elements.filter(el => el.action === 'click');
}

const customerRegistry = loadRegistry('customer-app.json');
const adminRegistry = loadRegistry('admin-app.json');

// ---------- Customer app functional audit ----------

if (customerRegistry) {
  for (const [routePath, route] of Object.entries(customerRegistry.routes)) {
    const clickableElements = getAllElements(route);
    if (clickableElements.length === 0) continue;

    test.describe(`Customer: ${route.page} (${routePath})`, () => {
      for (const element of clickableElements) {
        test(`${element.name}: ${element.expected}`, async ({ browser }) => {
          const context = await browser.newContext({
            baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
          });
          const pw = await context.newPage();

          // Login if page requires auth
          if (route.auth !== 'public') {
            await loginAsCustomer(pw);
          }

          await pw.goto(routePath);
          const el = pw.locator(element.selector);

          // Element must be visible
          await expect(el.first()).toBeVisible({ timeout: 10_000 });

          // Capture state before click
          const beforeUrl = pw.url();
          const beforeHTML = await pw.locator('body').innerHTML();

          // Click the element
          await el.first().click();

          // Wait for navigation or DOM change
          await pw.waitForTimeout(2000);

          // Capture state after click
          const afterUrl = pw.url();
          const afterHTML = await pw.locator('body').innerHTML();

          // The element must have DONE something
          const somethingHappened = afterUrl !== beforeUrl || afterHTML !== beforeHTML;
          expect(
            somethingHappened,
            `Facade detected: "${element.name}" (${element.selector}) rendered but clicking it changed nothing. Expected: ${element.expected}`,
          ).toBe(true);

          await context.close();
        });
      }
    });
  }
} else {
  test.skip('Customer registry not found', () => {});
}

// ---------- Admin app functional audit ----------

if (adminRegistry) {
  for (const [routePath, route] of Object.entries(adminRegistry.routes)) {
    const clickableElements = getAllElements(route);
    if (clickableElements.length === 0) continue;

    test.describe(`Admin: ${route.page} (${routePath})`, () => {
      for (const element of clickableElements) {
        test(`${element.name}: ${element.expected}`, async ({ browser }) => {
          const context = await browser.newContext({
            baseURL: process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com',
          });
          const pw = await context.newPage();

          // Login if page requires auth
          if (route.auth !== 'public') {
            await loginAsStaff(pw);
          }

          await pw.goto(routePath);
          const el = pw.locator(element.selector);

          // Element must be visible
          await expect(el.first()).toBeVisible({ timeout: 10_000 });

          // Capture state before click
          const beforeUrl = pw.url();
          const beforeHTML = await pw.locator('body').innerHTML();

          // Click the element
          await el.first().click();

          // Wait for navigation or DOM change
          await pw.waitForTimeout(2000);

          // Capture state after click
          const afterUrl = pw.url();
          const afterHTML = await pw.locator('body').innerHTML();

          // The element must have DONE something
          const somethingHappened = afterUrl !== beforeUrl || afterHTML !== beforeHTML;
          expect(
            somethingHappened,
            `Facade detected: "${element.name}" (${element.selector}) rendered but clicking it changed nothing. Expected: ${element.expected}`,
          ).toBe(true);

          await context.close();
        });
      }
    });
  }
} else {
  test.skip('Admin registry not found', () => {});
}
