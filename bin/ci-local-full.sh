#!/usr/bin/env bash

# ci-local-full.sh
# Full local CI runner - runs all CI checks INCLUDING integration tests
# Usage: pnpm run ci:local:full or ./bin/ci-local-full.sh
#
# This script provides complete CI parity by running:
# 1. All fast CI checks (via ci-local.sh)
# 2. Integration tests against LocalStack

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

  echo -e "${GREEN}Local CI Runner (Full Mode)${NC}"
  echo "============================="
  echo ""
  echo -e "${BLUE}This runs ALL CI checks including integration tests.${NC}"
  echo -e "${BLUE}For faster iteration, use 'pnpm run ci:local' instead.${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  # Run fast CI checks first
  echo -e "${YELLOW}Phase 1: Running fast CI checks...${NC}"
  echo ""
  ./bin/ci-local.sh

  # Run integration tests
  echo ""
  echo -e "${YELLOW}Phase 2: Running integration tests...${NC}"
  echo ""
  ./bin/test-integration.sh --cleanup

  # Calculate duration
  local END_TIME
  local DURATION
  local MINUTES
  local SECONDS
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  # Summary
  echo ""
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}Full Local CI Complete${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo ""
  echo "All checks passed in ${MINUTES}m ${SECONDS}s"
  echo ""
  echo "What was checked:"
  echo "  Everything from ci:local PLUS integration tests"
  echo ""
  echo "GitHub-specific checks (cannot be run locally):"
  echo "  Codecov upload, artifact storage, PR comments"
  echo ""
  echo -e "${GREEN}Ready to push with confidence!${NC}"
}

main "$@"
