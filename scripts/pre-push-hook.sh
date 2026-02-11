#!/bin/bash
# Pre-push hook: Type-check all apps before allowing push
# Prevents deploying broken TypeScript to production
#
# Install: chmod +x .git/hooks/pre-push
# Bypass:  git push --no-verify (emergency only)

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
FAILED=0
CHECKED=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-push verification: HTHD Production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Detect which apps have changes
CHANGED_FILES=$(git diff --name-only HEAD@{1}..HEAD 2>/dev/null || git diff --name-only HEAD~1..HEAD 2>/dev/null || echo "")

check_app() {
  local app_name="$1"
  local app_dir="$2"

  if [ ! -d "$REPO_ROOT/$app_dir" ]; then
    return
  fi

  # Check if node_modules exists
  if [ ! -d "$REPO_ROOT/$app_dir/node_modules" ]; then
    echo "  ⚠  $app_name: node_modules missing, skipping (run npm install)"
    return
  fi

  CHECKED=$((CHECKED + 1))
  printf "  %-20s" "$app_name:"

  # Run tsc --noEmit
  if (cd "$REPO_ROOT/$app_dir" && node_modules/.bin/tsc --noEmit 2>&1); then
    echo "✅ clean"
  else
    echo "❌ FAILED"
    echo ""
    echo "  TypeScript errors in $app_name:"
    (cd "$REPO_ROOT/$app_dir" && node_modules/.bin/tsc --noEmit --pretty 2>&1) || true
    echo ""
    FAILED=1
  fi
}

# Run ESLint on changed files for an app
lint_app() {
  local app_name="$1"
  local app_dir="$2"

  if [ ! -d "$REPO_ROOT/$app_dir" ]; then
    return
  fi

  if [ ! -f "$REPO_ROOT/$app_dir/node_modules/.bin/eslint" ]; then
    return
  fi

  # Find changed files in this app
  local changed=$(echo "$CHANGED_FILES" | grep "^$app_dir/src/" | head -20)
  if [ -z "$changed" ]; then
    return
  fi

  printf "  %-20s" "$app_name lint:"

  # Build file list relative to app dir
  local files=""
  while IFS= read -r f; do
    local rel="${f#$app_dir/}"
    if [ -f "$REPO_ROOT/$app_dir/$rel" ]; then
      files="$files $rel"
    fi
  done <<< "$changed"

  if [ -z "$files" ]; then
    echo "⏭  no lintable files"
    return
  fi

  if (cd "$REPO_ROOT/$app_dir" && node_modules/.bin/eslint --no-error-on-unmatched-pattern $files >/dev/null 2>&1); then
    echo "✅ clean"
  else
    echo "⚠  warnings (non-blocking)"
  fi
}

echo "Type checking..."
check_app "admin-app" "admin-app"
check_app "customer-app" "customer-app"
check_app "server" "server"

echo ""
echo "Linting changed files..."
lint_app "admin-app" "admin-app"
lint_app "customer-app" "customer-app"
lint_app "server" "server"

echo ""

if [ $FAILED -eq 1 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  🚫 PUSH BLOCKED: TypeScript errors detected"
  echo ""
  echo "  Fix the errors above, then push again."
  echo "  Emergency bypass: git push --no-verify"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

if [ $CHECKED -eq 0 ]; then
  echo "  ⚠  No apps checked (missing node_modules?)"
  echo "  Run 'npm install' in each app directory first."
  echo ""
  exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All $CHECKED apps passed. Pushing to production."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
exit 0
