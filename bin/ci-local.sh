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
  echo "  5. Dependency graph generation"
  echo "  6. esbuild build"
  echo "  7. Type checking"
  echo "  8. Linting"
  echo "  9. Formatting (dprint)"
  echo "  10. ShellCheck (bash linting)"
  echo "  11. ESLint local rules tests"
  echo "  12. MCP conventions validation"
  echo "  13. Config validation"
  echo "  14. API paths validation"
  echo "  15. Documentation validation"
  echo "  16. Documentation freshness validation"
  echo "  17. Dependency rules check"
  echo "  18. GraphRAG validation"
  echo "  19. Documentation sync validation"
  echo "  20. Unit tests"
  echo "  21. Test output validation"
  echo ""
  echo -e "${BLUE}Note: Integration tests skipped. Use 'pnpm run ci:local:full' for complete CI.${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  # Step 1: Environment checks
  echo -e "${YELLOW}[1/21] Checking prerequisites...${NC}"

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
  echo -e "${YELLOW}[2/21] Installing dependencies...${NC}"
  mkdir -p build
  pnpm install --frozen-lockfile
  echo -e "${GREEN}  Dependencies installed${NC}"

  # Security audit (part of dependency check)
  # Ignore tar CVEs (fastembed dev dependency requires tar 6.x for ESM default exports)
  # Ignore fast-xml-parser CVE (dev dependencies only: @redocly/cli, repomix, @aws-sdk/xml-builder)
  echo "  Running security audit..."
  if ! pnpm audit --audit-level=high \
    --ignore GHSA-8qq5-rm4j-mr97 \
    --ignore GHSA-r6q2-hw4h-h46w \
    --ignore GHSA-34x7-hfp2-rc4v \
    --ignore GHSA-37qj-frw5-hhjh; then
    echo -e "${RED}  Security audit found high severity vulnerabilities${NC}"
    echo "  Run 'pnpm audit' for details"
    exit 1
  fi
  echo -e "${GREEN}  Security audit passed${NC}"
  echo ""

  # Step 3: TypeSpec compilation
  echo -e "${YELLOW}[3/21] Compiling TypeSpec...${NC}"
  pnpm run typespec:check
  echo -e "${GREEN}  TypeSpec compilation passed${NC}"
  echo ""

  # Step 4: Build dependencies (Terraform types)
  echo -e "${YELLOW}[4/21] Building dependencies (Terraform types)...${NC}"
  pnpm run build:dependencies
  echo -e "${GREEN}  Build dependencies complete${NC}"
  echo ""

  # Step 5: Dependency graph generation
  echo -e "${YELLOW}[5/21] Generating dependency graph...${NC}"
  pnpm run generate:graph
  echo -e "${GREEN}  Dependency graph generated${NC}"
  echo ""

  # Step 6: esbuild build
  echo -e "${YELLOW}[6/21] Running esbuild build...${NC}"
  pnpm run build
  echo -e "${GREEN}  Build complete${NC}"
  echo ""

  # Step 7: Type checking
  echo -e "${YELLOW}[7/21] Running type checks...${NC}"
  pnpm run check:types
  pnpm run check:test:types
  echo -e "${GREEN}  Type checks passed${NC}"
  echo ""

  # Step 8: Linting
  echo -e "${YELLOW}[8/21] Running linter...${NC}"
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

  # Step 9: Formatting check (dprint)
  echo -e "${YELLOW}[9/21] Checking code formatting (dprint)...${NC}"
  if ! pnpm run format:check; then
    echo -e "${RED}Error: Code formatting check failed.${NC}"
    echo "Run 'pnpm run format' to fix."
    exit 1
  fi
  echo -e "${GREEN}  Code formatting passed${NC}"
  echo ""

  # Step 10: ShellCheck
  echo -e "${YELLOW}[10/21] Running ShellCheck...${NC}"
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

  # Step 11: ESLint local rules tests
  echo -e "${YELLOW}[11/21] Testing ESLint local rules...${NC}"
  pnpm run test:eslint:rules
  echo -e "${GREEN}  ESLint local rules tests passed${NC}"
  echo ""

  # Step 12: MCP conventions validation
  echo -e "${YELLOW}[12/21] Validating MCP conventions...${NC}"
  pnpm run validate:conventions
  echo -e "${GREEN}  MCP conventions passed${NC}"
  echo ""

  # Step 13: Config validation
  echo -e "${YELLOW}[13/21] Validating config...${NC}"
  pnpm run validate:config
  echo -e "${GREEN}  Config validation passed${NC}"
  echo ""

  # Step 14: API paths validation
  echo -e "${YELLOW}[14/21] Validating API paths...${NC}"
  pnpm run validate:api:paths
  echo -e "${GREEN}  API paths validation passed${NC}"
  echo ""

  # Step 15: Documentation validation
  echo -e "${YELLOW}[15/21] Validating documented scripts...${NC}"
  ./bin/validate-docs.sh
  echo ""

  # Step 16: Documentation freshness validation
  echo -e "${YELLOW}[16/21] Validating documentation freshness...${NC}"
  ./bin/validate-docs-freshness.sh
  echo ""

  # Step 17: Dependency rules check
  echo -e "${YELLOW}[17/21] Checking dependency rules...${NC}"
  pnpm run deps:check
  echo -e "${GREEN}  Dependency rules passed${NC}"
  echo ""

  # Step 18: GraphRAG validation
  echo -e "${YELLOW}[18/21] Validating GraphRAG...${NC}"
  ./bin/validate-graphrag.sh
  echo ""

  # Step 19: Documentation sync validation
  echo -e "${YELLOW}[19/21] Validating documentation sync...${NC}"
  ./bin/validate-doc-sync.sh
  echo ""

  # Step 20: Unit tests
  echo -e "${YELLOW}[20/21] Running unit tests...${NC}"
  TEST_OUTPUT=$(pnpm test 2>&1)
  TEST_EXIT_CODE=$?
  echo "$TEST_OUTPUT"

  if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}  Unit tests failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}  Unit tests passed${NC}"
  echo ""

  # Step 21: Validate test output is clean
  echo -e "${YELLOW}[21/21] Validating test output...${NC}"
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
  echo "  Environment, dependencies, security audit, TypeSpec, build dependencies, graph generation,"
  echo "  build, types, lint, formatting (dprint), ShellCheck, ESLint local rules, MCP conventions,"
  echo "  config, API paths, documentation, docs freshness, dependency rules, GraphRAG,"
  echo "  documentation sync, unit tests, test output validation"
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
