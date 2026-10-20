#!/usr/bin/env bash

# validate-graphrag.sh
# Validates that GraphRAG knowledge-graph.json is up to date
# Usage: pnpm run validate:graphrag or ./bin/validate-graphrag.sh

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
  echo -e "${YELLOW}Validating GraphRAG knowledge graph...${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  # Validate metadata.json completeness first
  echo -e "${BLUE}Step 1/2:${NC} Validating metadata.json completeness..."
  if ! pnpm run graphrag:validate; then
    error "metadata.json validation failed. All Lambdas must have entries in graphrag/metadata.json."
  fi
  echo ""

  # Generate build/graph.json if missing (required by graphrag:extract)
  if [[ ! -f "build/graph.json" ]]; then
    echo -e "${YELLOW}build/graph.json not found, generating...${NC}"
    pnpm exec mantle generate graph
  fi

  # Generate fresh GraphRAG. Delete the committed graph first: graphrag/extract.ts runs main()
  # only when import.meta.url equals `file://${__filename}`, which is false for a checkout path
  # that needs percent-encoding (one with a space, for example). It then exits 0 without
  # writing, and regenerating over the committed file would pass without measuring.
  echo -e "${BLUE}Step 2/2:${NC} Validating knowledge-graph.json is up to date..."
  rm -f graphrag/knowledge-graph.json
  pnpm run graphrag:extract

  if [[ ! -f graphrag/knowledge-graph.json ]]; then
    error "pnpm run graphrag:extract wrote no graphrag/knowledge-graph.json, so the graph was not measured."
  fi

  # Check for differences
  if ! git diff --quiet graphrag/knowledge-graph.json 2> /dev/null; then
    echo -e "${RED}GraphRAG knowledge-graph.json is out of date!${NC}"
    echo ""
    echo "Changes detected:"
    git diff --stat graphrag/knowledge-graph.json
    echo ""
    echo "Please run 'npx mantle generate graph && pnpm run graphrag:extract' locally and commit the changes."
    exit 1
  fi

  echo -e "${GREEN}GraphRAG is up to date${NC}"
}

main "$@"
