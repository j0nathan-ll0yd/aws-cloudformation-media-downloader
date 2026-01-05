#!/usr/bin/env bash

# validate-docs.sh
# Validates that documented pnpm scripts in AGENTS.md and README.md exist in package.json
# Usage: pnpm run validate:docs or ./bin/validate-docs.sh

set -euo pipefail # Exit on error, undefined vars, pipe failures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${YELLOW}Validating documented scripts...${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  local MISSING_SCRIPTS=""

  # Check AGENTS.md for pnpm run commands (supports camelCase like registerDevice)
  if [ -f "AGENTS.md" ]; then
    for script in $(grep -oE 'pnpm run [a-zA-Z:-]+' AGENTS.md 2> /dev/null | sed 's/pnpm run //' | sort -u); do
      if ! jq -e ".scripts[\"$script\"]" package.json > /dev/null 2>&1; then
        MISSING_SCRIPTS="$MISSING_SCRIPTS $script"
      fi
    done
  fi

  # Check README.md for pnpm/npm run commands (supports camelCase like registerDevice)
  if [ -f "README.md" ]; then
    for script in $(grep -oE '(pnpm|npm) run [a-zA-Z:-]+' README.md 2> /dev/null | sed 's/.*run //' | sort -u); do
      if ! jq -e ".scripts[\"$script\"]" package.json > /dev/null 2>&1; then
        MISSING_SCRIPTS="$MISSING_SCRIPTS $script"
      fi
    done
  fi

  if [ -n "$MISSING_SCRIPTS" ]; then
    echo -e "${RED}ERROR: The following scripts are documented but not in package.json:${NC}"
    echo "$MISSING_SCRIPTS" | tr ' ' '\n' | sort -u | grep -v '^$'
    echo ""
    echo "Please either:"
    echo "  1. Add the missing scripts to package.json"
    echo "  2. Remove or update the documentation references"
    exit 1
  fi

  echo -e "${GREEN}All documented scripts exist in package.json${NC}"
}

main "$@"
