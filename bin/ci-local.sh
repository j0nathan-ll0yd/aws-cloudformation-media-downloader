#!/usr/bin/env bash

# ci-local.sh
# Fast local CI runner - runs all CI checks except integration tests
# Usage: pnpm run ci:local or ./bin/ci-local.sh
#
# This script replicates the checks from GitHub Actions workflows locally,
# catching ~98% of issues that would fail in CI. For full CI parity including
# integration tests, use: pnpm run ci:local:full
#
# Performance: Uses parallel execution for independent validation steps.

set -e # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track timing
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
echo "  6. Type checking (parallel)"
echo "  7. Linting + Terraform formatting"
echo "  8. Formatting (dprint)"
echo "  9. ESLint local rules tests"
echo "  10. Documentation validation"
echo "  11. Dependency rules check"
echo "  12-14. Convention/Config/API validation (parallel)"
echo "  15. Security audit"
echo "  16. GraphRAG validation"
echo "  17. Documentation sync validation"
echo "  18. Unit tests"
echo "  19. Test output validation"
echo ""
echo -e "${BLUE}Note: Integration tests skipped. Use 'pnpm run ci:local:full' for complete CI.${NC}"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Environment checks
echo -e "${YELLOW}[1/19] Checking prerequisites...${NC}"

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
echo -e "${YELLOW}[2/19] Installing dependencies...${NC}"
mkdir -p build
pnpm install --frozen-lockfile
echo -e "${GREEN}  Dependencies installed${NC}"
echo ""

# Step 3: TypeSpec compilation
echo -e "${YELLOW}[3/19] Compiling TypeSpec...${NC}"
pnpm run typespec:check
echo -e "${GREEN}  TypeSpec compilation passed${NC}"
echo ""

# Step 4: Build dependencies (Terraform types)
echo -e "${YELLOW}[4/19] Building dependencies (Terraform types)...${NC}"
pnpm run build-dependencies
echo -e "${GREEN}  Build dependencies complete${NC}"
echo ""

# Step 5: esbuild build
echo -e "${YELLOW}[5/19] Running esbuild build...${NC}"
pnpm run build
echo -e "${GREEN}  Build complete${NC}"
echo ""

# Step 6: Type checking (PARALLEL)
echo -e "${YELLOW}[6/19] Running type checks (parallel)...${NC}"

# Create temp files for parallel job output
TYPE_CHECK_OUTPUT=$(mktemp)
TEST_TYPE_CHECK_OUTPUT=$(mktemp)
trap "rm -f $TYPE_CHECK_OUTPUT $TEST_TYPE_CHECK_OUTPUT" EXIT

(
  if pnpm run --silent check-types > "$TYPE_CHECK_OUTPUT" 2>&1; then
    echo -e "  ${GREEN}✓${NC} Main types"
  else
    echo -e "  ${RED}✗${NC} Main types failed"
    cat "$TYPE_CHECK_OUTPUT"
    exit 1
  fi
) &
PID_TYPES=$!

(
  if pnpm run --silent check-test-types > "$TEST_TYPE_CHECK_OUTPUT" 2>&1; then
    echo -e "  ${GREEN}✓${NC} Test types"
  else
    echo -e "  ${RED}✗${NC} Test types failed"
    cat "$TEST_TYPE_CHECK_OUTPUT"
    exit 1
  fi
) &
PID_TEST_TYPES=$!

# Wait for type checking jobs
TYPES_FAILED=0
wait $PID_TYPES || TYPES_FAILED=1
wait $PID_TEST_TYPES || TYPES_FAILED=1

if [ $TYPES_FAILED -ne 0 ]; then
  echo -e "${RED}  Type checks failed${NC}"
  exit 1
fi
echo -e "${GREEN}  Type checks passed${NC}"
echo ""

# Step 7: Linting
echo -e "${YELLOW}[7/19] Running linter...${NC}"
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
echo -e "${YELLOW}[8/19] Checking code formatting (dprint)...${NC}"
if ! pnpm run format:check; then
  echo -e "${RED}Error: Code formatting check failed.${NC}"
  echo "Run 'pnpm run format' to fix."
  exit 1
fi
echo -e "${GREEN}  Code formatting passed${NC}"
echo ""

# Step 9: ESLint local rules tests
echo -e "${YELLOW}[9/19] Testing ESLint local rules...${NC}"
pnpm run test:eslint-rules
echo -e "${GREEN}  ESLint local rules tests passed${NC}"
echo ""

# Step 10: Documentation validation
echo -e "${YELLOW}[10/19] Validating documented scripts...${NC}"
./bin/validate-docs.sh
echo ""

# Step 11: Dependency rules check
echo -e "${YELLOW}[11/19] Checking dependency rules...${NC}"
pnpm run deps:check
echo -e "${GREEN}  Dependency rules passed${NC}"
echo ""

# Steps 12-14: Convention, Config, API validation (PARALLEL)
echo -e "${YELLOW}[12-14/19] Running validation checks (parallel)...${NC}"

# Create temp files for parallel job output
CONV_OUTPUT=$(mktemp)
CONFIG_OUTPUT=$(mktemp)
API_OUTPUT=$(mktemp)
trap "rm -f $TYPE_CHECK_OUTPUT $TEST_TYPE_CHECK_OUTPUT $CONV_OUTPUT $CONFIG_OUTPUT $API_OUTPUT" EXIT

(
  if pnpm run --silent validate:conventions > "$CONV_OUTPUT" 2>&1; then
    echo -e "  ${GREEN}✓${NC} Conventions"
  else
    echo -e "  ${RED}✗${NC} Conventions failed"
    cat "$CONV_OUTPUT"
    exit 1
  fi
) &
PID_CONVENTIONS=$!

(
  if pnpm run --silent validate:config > "$CONFIG_OUTPUT" 2>&1; then
    echo -e "  ${GREEN}✓${NC} Config"
  else
    echo -e "  ${RED}✗${NC} Config failed"
    cat "$CONFIG_OUTPUT"
    exit 1
  fi
) &
PID_CONFIG=$!

(
  if pnpm run --silent validate:api-paths > "$API_OUTPUT" 2>&1; then
    echo -e "  ${GREEN}✓${NC} API paths"
  else
    echo -e "  ${RED}✗${NC} API paths failed"
    cat "$API_OUTPUT"
    exit 1
  fi
) &
PID_APIPATHS=$!

# Wait for all parallel validation jobs
VALIDATION_FAILED=0
wait $PID_CONVENTIONS || VALIDATION_FAILED=1
wait $PID_CONFIG || VALIDATION_FAILED=1
wait $PID_APIPATHS || VALIDATION_FAILED=1

if [ $VALIDATION_FAILED -ne 0 ]; then
  echo -e "${RED}  Validation checks failed${NC}"
  exit 1
fi
echo -e "${GREEN}  Validation checks passed${NC}"
echo ""

# Step 15: Security audit
echo -e "${YELLOW}[15/19] Running security audit...${NC}"
if ! pnpm audit --audit-level=high; then
  echo -e "${YELLOW}  Security audit found vulnerabilities (non-blocking)${NC}"
fi
echo -e "${GREEN}  Security audit complete${NC}"
echo ""

# Step 16: GraphRAG validation
echo -e "${YELLOW}[16/19] Validating GraphRAG...${NC}"
./bin/validate-graphrag.sh
echo ""

# Step 17: Documentation sync validation
echo -e "${YELLOW}[17/19] Validating documentation sync...${NC}"
./bin/validate-doc-sync.sh
echo ""

# Step 18: Unit tests
echo -e "${YELLOW}[18/19] Running unit tests...${NC}"
TEST_OUTPUT=$(pnpm test 2>&1)
TEST_EXIT_CODE=$?
echo "$TEST_OUTPUT"

if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}  Unit tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}  Unit tests passed${NC}"
echo ""

# Step 19: Validate test output is clean
echo -e "${YELLOW}[19/19] Validating test output...${NC}"
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
echo "  Environment, dependencies, TypeSpec, build, types (parallel), lint,"
echo "  formatting (dprint), ESLint local rules, documentation, dependency rules,"
echo "  conventions, config, API paths (parallel), security audit, GraphRAG,"
echo "  documentation sync, unit tests, test output validation"
echo ""
echo "What was NOT checked (run ci:local:full for these):"
echo "  Integration tests (LocalStack)"
echo ""
echo "GitHub-specific checks (cannot be run locally):"
echo "  Codecov upload, artifact storage, PR comments"
echo ""
echo -e "${GREEN}Ready to push!${NC}"
