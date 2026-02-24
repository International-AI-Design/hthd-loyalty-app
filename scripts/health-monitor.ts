#!/usr/bin/env npx ts-node
/**
 * Health monitor for Happy Tail production.
 * Run every 30 min via macOS launchd or manually.
 * On failure, writes stress signal to ferroai/spine/field/stress.jsonl
 *
 * Usage:
 *   npx ts-node scripts/health-monitor.ts
 *   API_URL=http://localhost:3000 npx ts-node scripts/health-monitor.ts
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const API_URL = process.env.API_URL || 'https://hthd-api.internationalaidesign.com';
const STRESS_FILE = path.resolve(__dirname, '../../ferroai/spine/field/stress.jsonl');

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
  duration_ms: number;
}

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(url, { timeout: 10_000 }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function checkHealth(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { status, body } = await httpGet(`${API_URL}/api/health`);
    return {
      name: 'api-health',
      passed: status === 200,
      detail: status !== 200 ? `Status ${status}: ${body}` : undefined,
      duration_ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: 'api-health',
      passed: false,
      detail: err.message,
      duration_ms: Date.now() - start,
    };
  }
}

async function checkDeepHealth(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { status, body } = await httpGet(`${API_URL}/api/health/deep`);
    const data = JSON.parse(body);
    return {
      name: 'db-connectivity',
      passed: status === 200 && data.db?.connected === true,
      detail: !data.db?.connected ? `DB not connected: ${data.db?.error}` : undefined,
      duration_ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name: 'db-connectivity',
      passed: false,
      detail: err.message,
      duration_ms: Date.now() - start,
    };
  }
}

function writeStressSignal(failures: CheckResult[]): void {
  const signal = {
    timestamp: new Date().toISOString(),
    source: 'health-monitor',
    severity: 'high',
    message: `Production health check failed: ${failures.map((f) => f.name).join(', ')}`,
    details: failures,
  };

  try {
    const dir = path.dirname(STRESS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(STRESS_FILE, JSON.stringify(signal) + '\n');
    console.log(`Stress signal written to ${STRESS_FILE}`);
  } catch (err) {
    console.error('Failed to write stress signal:', err);
  }
}

async function main(): Promise<void> {
  console.log(`Health Monitor — ${new Date().toISOString()}`);
  console.log(`API: ${API_URL}`);
  console.log('');

  const results = await Promise.all([checkHealth(), checkDeepHealth()]);

  const failures = results.filter((r) => !r.passed);

  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon}: ${r.name} (${r.duration_ms}ms)${r.detail ? ' — ' + r.detail : ''}`);
  }

  console.log('');

  if (failures.length > 0) {
    console.log(`${failures.length} check(s) FAILED`);
    writeStressSignal(failures);
    process.exit(1);
  } else {
    console.log('All checks passed');
  }
}

main();
