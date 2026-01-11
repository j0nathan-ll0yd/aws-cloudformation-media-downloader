#!/usr/bin/env bash

# ci-local.sh
# Fast local CI runner - runs all CI checks except integration tests
# Usage: pnpm run ci:local or ./bin/ci-local.sh
#
# This script replicates the checks from GitHub Actions workflows locally,
# catching ~95% of issues that would fail in CI. For full CI parity including
# integration tests, use: pnpm run ci:local:full

set -euo pipefail # Exit on error, undefined vars, pipe failures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  # Track timing
  local START_TIME
  START_TIME=$(date +%s)

  echo -e "${GREEN}Local CI Runner (Fast Mode)${NC}"
  echo "============================="
  echo ""
  echo "This runs the same checks as GitHub Actions CI:"
  echo "  1. Environment verification"
  echo "  2. Dependency installation"
  echo "  3. TypeSpec compilation"
  echo "  4. Build dependencies (Terraform types)"
  echo "  5. esbuild build"
  echo "  6. Type checking"
  echo "  7. Linting"
  echo "  8. Formatting (dprint)"
  echo "  9. ShellCheck (bash linting)"
  echo "  10. ESLint local rules tests"
  echo "  11. Documentation validation"
  echo "  12. Documentation freshness validation"
  echo "  13. Dependency rules check"
  echo "  14. GraphRAG validation"
  echo "  15. Documentation sync validation"
  echo "  16. Unit tests"
  echo "  17. Test output validation"
  echo ""
  echo -e "${BLUE}Note: Integration tests skipped. Use 'pnpm run ci:local:full' for complete CI.${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  # Step 1: Environment checks
  echo -e "${YELLOW}[1/17] Checking prerequisites...${NC}"

  # Check Node.js version
  REQUIRED_NODE_MAJOR=24
  CURRENT_NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
  if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_MAJOR" ]; then
    echo -e "${RED}Error: Node.js $REQUIRED_NODE_MAJOR+ required (found: $(node -v))${NC}"
    exit 1
  fi
  echo "  Node.js $(node -v)"

  # Check hcl2json (required for build-dependencies)
  if ! command -v hcl2json &> /dev/null; then
    echo -e "${RED}Error: hcl2json is not installed${NC}"
    echo "Install with: brew install hcl2json"
    exit 1
  fi
  echo "  hcl2json $(hcl2json --version 2>&1 | head -1 || echo 'installed')"

  # Check jq (required for validation scripts)
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
  fi
  echo "  jq $(jq --version)"

  echo -e "${GREEN}  Prerequisites satisfied${NC}"
  echo ""

  # Step 2: Create build directory and install dependencies
  echo -e "${YELLOW}[2/17] Installing dependencies...${NC}"
  mkdir -p build
  pnpm install --frozen-lockfile
  echo -e "${GREEN}  Dependencies installed${NC}"
  echo ""

  # Step 3: TypeSpec compilation
  echo -e "${YELLOW}[3/17] Compiling TypeSpec...${NC}"
  pnpm run typespec:check
  echo -e "${GREEN}  TypeSpec compilation passed${NC}"
  echo ""

  # Step 4: Build dependencies (Terraform types)
  echo -e "${YELLOW}[4/17] Building dependencies (Terraform types)...${NC}"
  pnpm run build:dependencies
  echo -e "${GREEN}  Build dependencies complete${NC}"
  echo ""

  # Step 5: esbuild build
  echo -e "${YELLOW}[5/17] Running esbuild build...${NC}"
  pnpm run build
  echo -e "${GREEN}  Build complete${NC}"
  echo ""

  # Step 6: Type checking
  echo -e "${YELLOW}[6/17] Running type checks...${NC}"
  pnpm run check:types
  pnpm run check:test:types
  echo -e "${GREEN}  Type checks passed${NC}"
  echo ""

  # Step 7: Linting
  echo -e "${YELLOW}[7/17] Running linter...${NC}"
  pnpm run lint

  # Check Terraform formatting
  if command -v tofu &> /dev/null; then
    if ! tofu fmt -check -recursive terraform/ > /dev/null; then
      echo -e "${RED}Error: Terraform formatting check failed.${NC}"
      echo "Run 'tofu fmt -recursive terraform/' to fix."
      exit 1
    fi
    echo "  Terraform formatting passed"
  else
    echo -e "${YELLOW}  Skipping Terraform formatting check (tofu not found)${NC}"
  fi

  echo -e "${GREEN}  Linting passed${NC}"
  echo ""

  # Step 8: Formatting check (dprint)
  echo -e "${YELLOW}[8/17] Checking code formatting (dprint)...${NC}"
  if ! pnpm run format:check; then
    echo -e "${RED}Error: Code formatting check failed.${NC}"
    echo "Run 'pnpm run format' to fix."
    exit 1
  fi
  echo -e "${GREEN}  Code formatting passed${NC}"
  echo ""

  # Step 9: ShellCheck
  echo -e "${YELLOW}[9/17] Running ShellCheck...${NC}"
  if command -v shellcheck &> /dev/null; then
    # Use severity filter to only fail on errors, not warnings/style
    if shellcheck --severity=error bin/*.sh .github/scripts/*.sh; then
      echo -e "${GREEN}  ShellCheck passed${NC}"
      # Show warnings as info but don't fail
      if ! shellcheck bin/*.sh .github/scripts/*.sh > /dev/null 2>&1; then
        echo -e "${YELLOW}  (ShellCheck found warnings - run 'pnpm run lint:bash' for details)${NC}"
      fi
    else
      echo -e "${RED}  ShellCheck found errors${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}  Skipping ShellCheck (not installed - install with 'brew install shellcheck')${NC}"
  fi
  echo ""

  # Step 10: ESLint local rules tests
  echo -e "${YELLOW}[10/17] Testing ESLint local rules...${NC}"
  pnpm run test:eslint:rules
  echo -e "${GREEN}  ESLint local rules tests passed${NC}"
  echo ""

  # Step 11: Documentation validation
  echo -e "${YELLOW}[11/17] Validating documented scripts...${NC}"
  ./bin/validate-docs.sh
  echo ""

  # Step 12: Documentation freshness validation
  echo -e "${YELLOW}[12/17] Validating documentation freshness...${NC}"
  ./bin/validate-docs-freshness.sh
  echo ""

  # Step 13: Dependency rules check
  echo -e "${YELLOW}[13/17] Checking dependency rules...${NC}"
  pnpm run deps:check
  echo -e "${GREEN}  Dependency rules passed${NC}"
  echo ""

  # Step 14: GraphRAG validation
  echo -e "${YELLOW}[14/17] Validating GraphRAG...${NC}"
  ./bin/validate-graphrag.sh
  echo ""

  # Step 15: Documentation sync validation
  echo -e "${YELLOW}[15/17] Validating documentation sync...${NC}"
  ./bin/validate-doc-sync.sh
  echo ""

  # Step 16: Unit tests
  echo -e "${YELLOW}[16/17] Running unit tests...${NC}"
  TEST_OUTPUT=$(pnpm test 2>&1)
  TEST_EXIT_CODE=$?
  echo "$TEST_OUTPUT"

  if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}  Unit tests failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}  Unit tests passed${NC}"
  echo ""

  # Step 17: Validate test output is clean
  echo -e "${YELLOW}[17/17] Validating test output...${NC}"
  TEST_ISSUES=0

  # Check for Vitest deprecation warnings
  if echo "$TEST_OUTPUT" | grep -q "DEPRECATED"; then
    echo -e "${RED}  Error: Found Vitest deprecation warnings${NC}"
    echo "$TEST_OUTPUT" | grep "DEPRECATED" | head -3
    TEST_ISSUES=$((TEST_ISSUES + 1))
  fi

  # Check for EMF metrics spam (Powertools not silenced)
  if echo "$TEST_OUTPUT" | grep -q '"_aws".*"CloudWatchMetrics"'; then
    echo -e "${RED}  Error: Found Powertools EMF metrics in test output${NC}"
    echo "  Ensure POWERTOOLS_METRICS_DISABLED=true in test/setup.ts"
    TEST_ISSUES=$((TEST_ISSUES + 1))
  fi

  # Check for MCR source content warnings
  if echo "$TEST_OUTPUT" | grep -q "\[MCR\] not found source content"; then
    echo -e "${RED}  Error: Found MCR source content warnings${NC}"
    echo "$TEST_OUTPUT" | grep "\[MCR\] not found" | head -3
    TEST_ISSUES=$((TEST_ISSUES + 1))
  fi

  if [ $TEST_ISSUES -gt 0 ]; then
    echo -e "${RED}  Test output validation failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}  Test output is clean${NC}"
  echo ""

  # Calculate duration
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  # Summary
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}Local CI Complete${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo ""
  echo "All checks passed in ${MINUTES}m ${SECONDS}s"
  echo ""
  echo "What was checked:"
  echo "  Environment, dependencies, TypeSpec, build, types, lint, formatting (dprint),"
  echo "  ShellCheck, ESLint local rules, documentation, docs freshness, dependency rules,"
  echo "  GraphRAG, documentation sync, unit tests, test output validation"
  echo ""
  echo "What was NOT checked (run ci:local:full for these):"
  echo "  Integration tests (LocalStack)"
  echo ""
  echo "GitHub-specific checks (cannot be run locally):"
  echo "  Codecov upload, artifact storage, PR comments"
  echo ""
  echo -e "${GREEN}Ready to push!${NC}"
}

main "$@"
