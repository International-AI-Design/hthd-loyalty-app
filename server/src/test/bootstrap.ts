/**
 * Environment bootstrap for test files.
 *
 * MUST be imported FIRST in every test file (before setup.ts or any module
 * that touches prisma) so that DATABASE_URL is set before prisma.ts evaluates.
 *
 * Usage in test files:
 *   import '../../test/bootstrap';   // <-- FIRST import
 *   import { createTestApp } from '../../test/setup';
 */
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the server root (two dirs up from src/test/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Prefer TEST_DATABASE_URL over DATABASE_URL
if (process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Record whether a real DB URL exists before we set the dummy fallback
const hasRealDb = !!(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
process.env.__TEST_HAS_REAL_DB = hasRealDb ? '1' : '0';

// If still no DATABASE_URL, set a dummy so prisma.ts doesn't throw at import time.
// Tests will skip via hasTestDatabase() when no real DB is available.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
}
