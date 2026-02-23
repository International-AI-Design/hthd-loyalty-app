/**
 * Standalone smoke test for a live HTHD API environment.
 *
 * Usage:
 *   npx ts-node scripts/smoke-test.ts http://localhost:3001
 *   npx ts-node scripts/smoke-test.ts https://hthd-api.internationalaidesign.com
 */

const BASE_URL = process.argv[2];

if (!BASE_URL) {
  console.error('Usage: npx ts-node scripts/smoke-test.ts <base-url>');
  process.exit(1);
}

// ── Color helpers ─────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function pass(label: string, detail?: string) {
  const extra = detail ? ` (${detail})` : '';
  console.log(`  ${GREEN}PASS${RESET}  ${label}${extra}`);
}

function fail(label: string, detail?: string) {
  const extra = detail ? ` (${detail})` : '';
  console.log(`  ${RED}FAIL${RESET}  ${label}${extra}`);
}

// ── Types ─────────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
}

// ── HTTP helper ───────────────────────────────────────────────────────

async function fetchCheck(
  method: string,
  path: string,
  opts?: { body?: object; expectStatus?: number | number[]; expectBody?: (body: any) => boolean; label?: string }
): Promise<CheckResult> {
  const label = opts?.label ?? `${method} ${path}`;
  const url = `${BASE_URL}${path}`;
  const expectedStatuses = Array.isArray(opts?.expectStatus)
    ? opts.expectStatus
    : opts?.expectStatus
      ? [opts.expectStatus]
      : [200];
  const timeout = 5000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const start = Date.now();
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const latency = Date.now() - start;
    clearTimeout(timer);

    const body = await res.json().catch(() => null);
    const statusOk = expectedStatuses.includes(res.status);
    const bodyOk = opts?.expectBody ? opts.expectBody(body) : true;
    const latencyOk = latency < timeout;

    if (statusOk && bodyOk && latencyOk) {
      return { label, passed: true, detail: `${res.status} in ${latency}ms` };
    }

    const reasons: string[] = [];
    if (!statusOk) reasons.push(`status ${res.status}, expected ${expectedStatuses.join('|')}`);
    if (!bodyOk) reasons.push('body shape mismatch');
    if (!latencyOk) reasons.push(`latency ${latency}ms > ${timeout}ms`);
    return { label, passed: false, detail: reasons.join('; ') };
  } catch (err: any) {
    clearTimeout(timer);
    const msg = err.name === 'AbortError' ? 'timeout (>5s)' : err.message;
    return { label, passed: false, detail: msg };
  }
}

// ── Checks ────────────────────────────────────────────────────────────

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Health endpoints
  results.push(
    await fetchCheck('GET', '/api/health', {
      expectStatus: 200,
      expectBody: (b) => b?.status === 'ok',
      label: 'GET /api/health → status ok',
    })
  );

  results.push(
    await fetchCheck('GET', '/api/health/deep', {
      expectStatus: 200,
      expectBody: (b) => b?.db?.connected === true,
      label: 'GET /api/health/deep → db.connected true',
    })
  );

  // 2. Critical admin routes exist (should return 401 not 404 without auth)
  results.push(
    await fetchCheck('GET', '/api/v2/admin/dashboard', {
      expectStatus: 401,
      label: 'GET /api/v2/admin/dashboard → 401 (not 404)',
    })
  );

  results.push(
    await fetchCheck('GET', '/api/v2/admin/bookings/schedule?date=2026-02-23', {
      expectStatus: 401,
      label: 'GET /api/v2/admin/bookings/schedule → 401 (not 404)',
    })
  );

  results.push(
    await fetchCheck('GET', '/api/v2/admin/messaging/conversations', {
      expectStatus: 401,
      label: 'GET /api/v2/admin/messaging/conversations → 401 (not 404)',
    })
  );

  results.push(
    await fetchCheck('POST', '/api/v2/admin/aim/chat', {
      body: { message: 'smoke test' },
      expectStatus: 401,
      label: 'POST /api/v2/admin/aim/chat → 401 (not 404)',
    })
  );

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}HTHD API Smoke Test${RESET}`);
  console.log(`Target: ${YELLOW}${BASE_URL}${RESET}\n`);

  const results = await runChecks();

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    if (r.passed) {
      pass(r.label, r.detail);
      passed++;
    } else {
      fail(r.label, r.detail);
      failed++;
    }
  }

  console.log(`\n${BOLD}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET} out of ${results.length} checks\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
