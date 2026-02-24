#!/usr/bin/env bash
set -euo pipefail

# Post-deploy E2E smoke test
# Runs critical path tests against production after deploy
#
# Usage:
#   ./scripts/post-deploy-e2e.sh
#   API_URL=http://localhost:3000 ./scripts/post-deploy-e2e.sh  # local testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Post-Deploy E2E Smoke Test ==="
echo "Time: $(date)"
echo ""

# 1. Health check
echo "--- Health Check ---"
API_URL="${API_URL:-https://hthd-api.internationalaidesign.com}"
HEALTH=$(curl -sf "${API_URL}/api/health" 2>&1) || {
  echo "FAIL: API health check failed"
  echo "$HEALTH"
  exit 1
}
echo "OK: API is healthy"

# 2. Deep health (DB connectivity)
echo "--- Deep Health Check ---"
DEEP=$(curl -sf "${API_URL}/api/health/deep" 2>&1) || {
  echo "FAIL: DB connectivity check failed"
  echo "$DEEP"
  exit 1
}
echo "OK: Database connected"

# 3. Run critical Playwright tests
echo ""
echo "--- Critical Path E2E Tests ---"
cd "$PROJECT_DIR"

npx playwright test \
  --project=customer-desktop \
  --grep="@critical|@smoke" \
  --reporter=list \
  2>&1 || {
  echo ""
  echo "FAIL: Critical E2E tests failed after deploy!"
  echo "Check test-results/ for screenshots and traces."
  exit 1
}

echo ""
echo "--- Admin Smoke Tests ---"
npx playwright test \
  --project=admin-desktop \
  --grep="@critical|@smoke" \
  --reporter=list \
  2>&1 || {
  echo ""
  echo "FAIL: Admin E2E tests failed after deploy!"
  exit 1
}

echo ""
echo "=== All post-deploy checks passed ==="
