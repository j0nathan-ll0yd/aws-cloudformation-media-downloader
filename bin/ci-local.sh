#!/usr/bin/env bash

# ci-local.sh
# Fast local CI runner - runs all CI checks except integration tests
# Usage: pnpm run ci:local or ./bin/ci-local.sh
#
# This script replicates the checks from GitHub Actions workflows locally,
# catching ~95% of issues that would fail in CI. For full CI parity including
# integration tests, use: pnpm run ci:local:full

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
echo "  6. Type checking"
echo "  7. Linting"
echo "  8. ESLint local rules tests"
echo "  9. Documentation validation"
echo "  10. Dependency rules check"
echo "  11. GraphRAG validation"
echo "  12. Documentation sync validation"
echo "  13. Unit tests"
echo "  14. Test output validation"
echo ""
echo -e "${BLUE}Note: Integration tests skipped. Use 'pnpm run ci:local:full' for complete CI.${NC}"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Environment checks
echo -e "${YELLOW}[1/14] Checking prerequisites...${NC}"

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
echo -e "${YELLOW}[2/14] Installing dependencies...${NC}"
mkdir -p build
pnpm install --frozen-lockfile
echo -e "${GREEN}  Dependencies installed${NC}"
echo ""

# Step 3: TypeSpec compilation
echo -e "${YELLOW}[3/14] Compiling TypeSpec...${NC}"
pnpm run typespec:check
echo -e "${GREEN}  TypeSpec compilation passed${NC}"
echo ""

# Step 4: Build dependencies (Terraform types)
echo -e "${YELLOW}[4/14] Building dependencies (Terraform types)...${NC}"
pnpm run build-dependencies
echo -e "${GREEN}  Build dependencies complete${NC}"
echo ""

# Step 5: esbuild build
echo -e "${YELLOW}[5/14] Running esbuild build...${NC}"
pnpm run build
echo -e "${GREEN}  Build complete${NC}"
echo ""

# Step 6: Type checking
echo -e "${YELLOW}[6/14] Running type checks...${NC}"
pnpm run check-types
pnpm run check-test-types
echo -e "${GREEN}  Type checks passed${NC}"
echo ""

# Step 7: Linting
echo -e "${YELLOW}[7/14] Running linter...${NC}"
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

# Step 8: ESLint local rules tests
echo -e "${YELLOW}[8/14] Testing ESLint local rules...${NC}"
pnpm run test:eslint-rules
echo -e "${GREEN}  ESLint local rules tests passed${NC}"
echo ""

# Step 9: Documentation validation
echo -e "${YELLOW}[9/14] Validating documented scripts...${NC}"
./bin/validate-docs.sh
echo ""

# Step 10: Dependency rules check
echo -e "${YELLOW}[10/14] Checking dependency rules...${NC}"
pnpm run deps:check
echo -e "${GREEN}  Dependency rules passed${NC}"
echo ""

# Step 11: GraphRAG validation
echo -e "${YELLOW}[11/14] Validating GraphRAG...${NC}"
./bin/validate-graphrag.sh
echo ""

# Step 12: Documentation sync validation
echo -e "${YELLOW}[12/14] Validating documentation sync...${NC}"
./bin/validate-doc-sync.sh
echo ""

# Step 13: Unit tests
echo -e "${YELLOW}[13/14] Running unit tests...${NC}"
TEST_OUTPUT=$(pnpm test 2>&1)
TEST_EXIT_CODE=$?
echo "$TEST_OUTPUT"

if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}  Unit tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}  Unit tests passed${NC}"
echo ""

# Step 14: Validate test output is clean
echo -e "${YELLOW}[14/14] Validating test output...${NC}"
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
echo "  Environment, dependencies, TypeSpec, build, types, lint, ESLint local rules,"
echo "  documentation, dependency rules, GraphRAG, documentation sync, unit tests,"
echo "  test output validation (deprecation, EMF metrics, MCR warnings)"
echo ""
echo "What was NOT checked (run ci:local:full for these):"
echo "  Integration tests (LocalStack)"
echo ""
echo "GitHub-specific checks (cannot be run locally):"
echo "  Codecov upload, artifact storage, PR comments"
echo ""
echo -e "${GREEN}Ready to push!${NC}"
