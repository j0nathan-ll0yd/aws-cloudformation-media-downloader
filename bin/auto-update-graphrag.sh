#!/usr/bin/env bash
# Script: auto-update-graphrag.sh
# Purpose: Auto-update GraphRAG knowledge graph when relevant files change
# Usage: Triggered by CI or as a git hook

set -euo pipefail

# Color definitions
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

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

main() {
  echo -e "${BLUE}➜${NC} Checking for changes that require GraphRAG update..."

  # Files that require GraphRAG re-extraction when changed
  local TRIGGER_PATHS=(
    "src/lambdas/"
    "src/entities/"
    "src/lib/vendor/"
    "graphrag/metadata.json"
    "tsp/"
  )

  # Check if any trigger files have changed
  local CHANGED_FILES
  CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2> /dev/null || echo "")

  if [ -z "$CHANGED_FILES" ]; then
    echo -e "${BLUE}➜${NC} No changes detected (possibly first commit)"
    exit 0
  fi

  local NEEDS_UPDATE=false

  for path in "${TRIGGER_PATHS[@]}"; do
    if echo "$CHANGED_FILES" | grep -q "^${path}"; then
      echo -e "${BLUE}➜${NC} Detected changes in: $path"
      NEEDS_UPDATE=true
      break
    fi
  done

  if [ "$NEEDS_UPDATE" = true ]; then
    echo -e "${BLUE}➜${NC} Updating GraphRAG knowledge graph..."
    pnpm run graphrag:extract

    echo -e "${GREEN}✓${NC} GraphRAG knowledge graph updated"
    echo -e "${BLUE}➜${NC} Vector database is now synchronized with source code"
  else
    echo -e "${GREEN}✓${NC} No GraphRAG update needed"
  fi
}

main "$@"
