#!/usr/bin/env bash

# validate-graphrag.sh
# Validates that GraphRAG knowledge-graph.json is up to date
# Usage: pnpm run validate:graphrag or ./bin/validate-graphrag.sh

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Validating GraphRAG knowledge graph...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Generate fresh GraphRAG
pnpm run graphrag:extract

# Check for differences
if ! git diff --quiet graphrag/knowledge-graph.json 2>/dev/null; then
  echo -e "${RED}GraphRAG knowledge-graph.json is out of date!${NC}"
  echo ""
  echo "Changes detected:"
  git diff --stat graphrag/knowledge-graph.json
  echo ""
  echo "Please run 'pnpm run graphrag:extract' locally and commit the changes."
  exit 1
fi

echo -e "${GREEN}GraphRAG is up to date${NC}"
