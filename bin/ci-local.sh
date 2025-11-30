#!/usr/bin/env bash

# ci-local.sh
# Fast local CI runner - runs all CI checks except integration tests
# Usage: pnpm run ci:local or ./bin/ci-local.sh
#
# This script replicates the checks from GitHub Actions workflows locally,
# catching ~95% of issues that would fail in CI. For full CI parity including
# integration tests, use: pnpm run ci:local:full

set -e  # Exit on error

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
echo "  3. Build dependencies (Terraform types)"
echo "  4. Webpack build"
echo "  5. Type checking"
echo "  6. Linting"
echo "  7. Documentation validation"
echo "  8. Dependency rules check"
echo "  9. GraphRAG validation"
echo "  10. Unit tests"
echo ""
echo -e "${BLUE}Note: Integration tests skipped. Use 'pnpm run ci:local:full' for complete CI.${NC}"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Environment checks
echo -e "${YELLOW}[1/10] Checking prerequisites...${NC}"

# Check Node.js version
REQUIRED_NODE_MAJOR=22
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
echo -e "${YELLOW}[2/10] Installing dependencies...${NC}"
mkdir -p build
pnpm install --frozen-lockfile
echo -e "${GREEN}  Dependencies installed${NC}"
echo ""

# Step 3: Build dependencies (Terraform types)
echo -e "${YELLOW}[3/10] Building dependencies (Terraform types)...${NC}"
pnpm run build-dependencies
echo -e "${GREEN}  Build dependencies complete${NC}"
echo ""

# Step 4: Webpack build
echo -e "${YELLOW}[4/10] Running webpack build...${NC}"
pnpm run build
echo -e "${GREEN}  Build complete${NC}"
echo ""

# Step 5: Type checking
echo -e "${YELLOW}[5/10] Running type checks...${NC}"
pnpm run check-types
echo -e "${GREEN}  Type checks passed${NC}"
echo ""

# Step 6: Linting
echo -e "${YELLOW}[6/10] Running linter...${NC}"
pnpm run lint
echo -e "${GREEN}  Linting passed${NC}"
echo ""

# Step 7: Documentation validation
echo -e "${YELLOW}[7/10] Validating documented scripts...${NC}"
./bin/validate-docs.sh
echo ""

# Step 8: Dependency rules check
echo -e "${YELLOW}[8/10] Checking dependency rules...${NC}"
pnpm run deps:check
echo -e "${GREEN}  Dependency rules passed${NC}"
echo ""

# Step 9: GraphRAG validation
echo -e "${YELLOW}[9/10] Validating GraphRAG...${NC}"
./bin/validate-graphrag.sh
echo ""

# Step 10: Unit tests
echo -e "${YELLOW}[10/10] Running unit tests...${NC}"
pnpm test
echo -e "${GREEN}  Unit tests passed${NC}"
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
echo "  Environment, dependencies, build, types, lint,"
echo "  documentation, dependency rules, GraphRAG, unit tests"
echo ""
echo "What was NOT checked (run ci:local:full for these):"
echo "  Integration tests (LocalStack)"
echo ""
echo "GitHub-specific checks (cannot be run locally):"
echo "  Codecov upload, artifact storage, PR comments"
echo ""
echo -e "${GREEN}Ready to push!${NC}"
