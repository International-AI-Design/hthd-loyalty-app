#!/bin/bash
# Post-deploy verification for HTHD production
# Usage: ./scripts/verify-deploy.sh
#
# Checks all three services are live and responding correctly.
# Run after every deployment to confirm nothing broke.

set -e

API_URL="https://hthd-api.internationalaidesign.com"
ADMIN_URL="https://hthd-admin.internationalaidesign.com"
CUSTOMER_URL="https://hthd.internationalaidesign.com"

FAILED=0
CHECKED=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Post-deploy verification: HTHD Production"
echo "  $(date '+%Y-%m-%d %H:%M %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_url() {
  local name="$1"
  local url="$2"
  local expect_json="$3"

  CHECKED=$((CHECKED + 1))
  printf "  %-20s" "$name:"

  local http_code
  local response
  local time_total

  response=$(curl -s -w "\n%{http_code}\n%{time_total}" --max-time 15 "$url" 2>&1)
  time_total=$(echo "$response" | tail -1)
  http_code=$(echo "$response" | tail -2 | head -1)
  body=$(echo "$response" | sed '$d' | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✅ HTTP 200 (${time_total}s)"

    # For API deep health, verify DB connection
    if [ "$expect_json" = "true" ]; then
      db_connected=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db',{}).get('connected',''))" 2>/dev/null || echo "")
      if [ "$db_connected" = "True" ]; then
        db_latency=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db',{}).get('latencyMs','?'))" 2>/dev/null || echo "?")
        echo "                      DB connected (${db_latency}ms)"
      else
        echo "                      ⚠  DB connection status unclear"
      fi
    fi
  else
    echo "❌ HTTP $http_code (${time_total}s)"
    FAILED=1
  fi
}

echo "Service health..."
check_url "API (deep health)" "$API_URL/api/health/deep" "true"
check_url "API (basic)" "$API_URL/api/health" "false"
check_url "Admin App" "$ADMIN_URL" "false"
check_url "Customer App" "$CUSTOMER_URL" "false"

echo ""

# Check for recent errors in deploy logs if railway CLI is available
if command -v railway &> /dev/null; then
  echo "Recent deploy logs (last 10 lines)..."
  railway logs --lines 10 2>/dev/null || echo "  (Could not fetch Railway logs)"
  echo ""
fi

if [ $FAILED -eq 1 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  🚫 VERIFICATION FAILED: $FAILED service(s) down"
  echo "  Check Railway dashboard and Vercel deployments."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All $CHECKED services verified. Deploy healthy."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
exit 0
