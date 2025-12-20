#!/usr/bin/env bash

# validate-doc-sync.sh
# Validates documentation stays in sync with codebase
# Usage: pnpm run validate:doc-sync or ./bin/validate-doc-sync.sh
#
# This script detects documentation drift by checking:
#   1. Entity count matches src/entities/*.ts files
#   2. Lambda count matches trigger table in AGENTS.md
#   3. MCP rule count matches documentation
#   4. Documented paths exist in filesystem
#   5. No stale patterns (Prettier, wrong vendor path)
#   6. GraphRAG metadata includes all entities
#   7. Wiki internal links resolve
#
# Issue #145: Living Documentation System with Stale Page Detection

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Validating documentation sync...${NC}"
echo ""

cd "$PROJECT_ROOT"

ERRORS=""
WARNINGS=""

# =============================================================================
# Check 1: Entity count matches documentation
# =============================================================================
echo -n "  [1/7] Checking entity count... "
ENTITY_COUNT=$(find src/entities -name "*.ts" ! -name "*.test.ts" ! -name "index.ts" 2> /dev/null | wc -l | tr -d ' ')

# Count entity files listed in AGENTS.md between entities/ and lambdas/ sections
# Each entity file is listed with │   │   ├── or │   │   └──
DOCUMENTED_ENTITY_COUNT=$(awk '/entities\/.*ElectroDB/,/lambdas\/.*Lambda/' AGENTS.md 2> /dev/null | grep -E '│.*\.ts' | wc -l | tr -d ' ')

if [ "$ENTITY_COUNT" -ne "$DOCUMENTED_ENTITY_COUNT" ]; then
  echo -e "${RED}MISMATCH${NC}"
  ERRORS="$ERRORS\n  - Entity count: found $ENTITY_COUNT files in src/entities/, documented $DOCUMENTED_ENTITY_COUNT in AGENTS.md"
else
  echo -e "${GREEN}OK${NC} ($ENTITY_COUNT entities)"
fi

# =============================================================================
# Check 2: Lambda count matches documentation
# =============================================================================
echo -n "  [2/7] Checking Lambda count... "
LAMBDA_COUNT=$(find src/lambdas -mindepth 1 -maxdepth 1 -type d 2> /dev/null | wc -l | tr -d ' ')

# Count rows in Lambda Trigger Patterns table (lines starting with | and uppercase letter, excluding header)
# Skip lines containing "Trigger Type" or "---" (header/separator rows)
TRIGGER_TABLE_COUNT=$(awk '/### Lambda Trigger Patterns/,/### Data Access/' AGENTS.md 2> /dev/null | grep -E '^\| [A-Z]' | grep -v 'Trigger Type' | grep -v '\-\-\-' | wc -l | tr -d ' ')

if [ "$LAMBDA_COUNT" -ne "$TRIGGER_TABLE_COUNT" ]; then
  echo -e "${RED}MISMATCH${NC}"
  ERRORS="$ERRORS\n  - Lambda count: found $LAMBDA_COUNT directories in src/lambdas/, documented $TRIGGER_TABLE_COUNT in trigger table"
else
  echo -e "${GREEN}OK${NC} ($LAMBDA_COUNT Lambdas)"
fi

# =============================================================================
# Check 3: MCP validation rule count
# =============================================================================
echo -n "  [3/7] Checking MCP rule count... "
MCP_RULE_COUNT=$(find src/mcp/validation/rules -name "*.ts" ! -name "*.test.ts" ! -name "index.ts" ! -name "types.ts" 2> /dev/null | wc -l | tr -d ' ')

# Count rules in the allRules array by counting lines ending with "Rule" or "Rule,"
# This counts the actual rule references in the array
REGISTERED_RULE_COUNT=$(sed -n '/export const allRules/,/^]/p' src/mcp/validation/index.ts 2> /dev/null | grep -cE '[a-z]Rule,?$' || echo "0")

if [ "$MCP_RULE_COUNT" -ne "$REGISTERED_RULE_COUNT" ]; then
  echo -e "${RED}MISMATCH${NC}"
  ERRORS="$ERRORS\n  - MCP rules: found $MCP_RULE_COUNT rule files, $REGISTERED_RULE_COUNT registered in index.ts"
else
  echo -e "${GREEN}OK${NC} ($MCP_RULE_COUNT rules)"
fi

# =============================================================================
# Check 4: Critical paths exist
# =============================================================================
echo -n "  [4/7] Checking documented paths exist... "
PATHS_OK=true

REQUIRED_PATHS=(
  "src/lib/vendor/AWS"
  "src/lib/vendor/BetterAuth"
  "src/lib/vendor/ElectroDB"
  "src/mcp"
  "src/mcp/validation"
  "test/helpers"
  "graphrag"
)

for path in "${REQUIRED_PATHS[@]}"; do
  if [ ! -e "$path" ]; then
    ERRORS="$ERRORS\n  - Missing documented path: $path"
    PATHS_OK=false
  fi
done

if [ "$PATHS_OK" = true ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# =============================================================================
# Check 5: Forbidden patterns in AGENTS.md
# =============================================================================
echo -n "  [5/7] Checking for stale patterns... "
STALE_OK=true

# Check for old Prettier reference (should be dprint)
if grep -q "Prettier" AGENTS.md 2> /dev/null; then
  ERRORS="$ERRORS\n  - AGENTS.md references 'Prettier' but project uses 'dprint'"
  STALE_OK=false
fi

# Check for wrong vendor path (lib/vendor without src/ prefix, not in a comment)
# Only flag if there's NO src/lib/vendor reference anywhere
if ! grep -q "src/lib/vendor" AGENTS.md 2> /dev/null; then
  ERRORS="$ERRORS\n  - AGENTS.md missing src/lib/vendor reference"
  STALE_OK=false
fi

if [ "$STALE_OK" = true ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}STALE${NC}"
fi

# =============================================================================
# Check 6: GraphRAG metadata completeness
# =============================================================================
echo -n "  [6/7] Checking GraphRAG metadata... "
GRAPHRAG_OK=true

# Get entity names from filesystem (excluding Collections.ts which is a service, not entity)
FS_ENTITIES=$(find src/entities -name "*.ts" ! -name "*.test.ts" ! -name "index.ts" ! -name "Collections.ts" -exec basename {} .ts \; 2> /dev/null | sort)

# Check each entity appears in metadata.json entityRelationships
for entity in $FS_ENTITIES; do
  if ! grep -q "\"$entity\"" graphrag/metadata.json 2> /dev/null; then
    WARNINGS="$WARNINGS\n  - Entity '$entity' not found in graphrag/metadata.json entityRelationships"
    GRAPHRAG_OK=false
  fi
done

if [ "$GRAPHRAG_OK" = true ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}INCOMPLETE${NC} (warning only)"
fi

# =============================================================================
# Check 7: Wiki internal links resolve
# =============================================================================
echo -n "  [7/7] Checking wiki links... "
WIKI_OK=true
BROKEN_LINKS=""

# Find all markdown files in docs/wiki and check their links
while IFS= read -r md_file; do
  # Extract relative markdown links: [text](path.md) or [text](../path.md)
  # Filter out code blocks first (``` fenced blocks) to avoid false positives from examples
  while IFS= read -r link; do
    # Skip empty results
    [ -z "$link" ] && continue

    # Skip external links and anchors
    [[ "$link" == http* ]] && continue
    [[ "$link" == "#"* ]] && continue

    # Remove anchor from link if present
    link_path="${link%%#*}"

    # Skip if empty after removing anchor
    [ -z "$link_path" ] && continue

    # Resolve relative path from the markdown file's directory
    md_dir=$(dirname "$md_file")
    target_path="$md_dir/$link_path"

    # Normalize and check if file exists
    if [ ! -f "$target_path" ]; then
      BROKEN_LINKS="$BROKEN_LINKS\n  - $md_file: broken link to '$link_path'"
      WIKI_OK=false
    fi
  done < <(awk 'BEGIN{c=0; bt=sprintf("%c",96); pat="^" bt bt bt} $0 ~ pat {c=1-c; next} c==0{print}' "$md_file" 2> /dev/null | grep -oE '\]\([^)]+\.md[^)]*\)' | sed 's/\](\([^)]*\))/\1/' | sed 's/#.*//' || true)
done < <(find docs/wiki -name "*.md" 2> /dev/null)

if [ "$WIKI_OK" = true ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}BROKEN LINKS${NC} (warning only)"
  WARNINGS="$WARNINGS$BROKEN_LINKS"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""

# Show warnings if any
if [ -n "$WARNINGS" ]; then
  echo -e "${YELLOW}Warnings:${NC}"
  echo -e "$WARNINGS"
  echo ""
fi

# Fail on errors
if [ -n "$ERRORS" ]; then
  echo -e "${RED}Documentation sync validation failed:${NC}"
  echo -e "$ERRORS"
  echo ""
  echo "To fix these issues:"
  echo "  1. Update AGENTS.md to reflect current codebase state"
  echo "  2. Update graphrag/metadata.json if entities changed"
  echo "  3. Run 'pnpm run graphrag:extract' to regenerate knowledge graph"
  echo "  4. Fix any broken wiki links"
  exit 1
fi

echo -e "${GREEN}Documentation is in sync with codebase${NC}"
