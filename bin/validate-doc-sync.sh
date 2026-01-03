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
#   7. Wiki internal links resolve (BLOCKING)
#   8. Documentation structure (markdown in wiki/, machine files in root)
#   9. Code path references in wiki docs
#  10. Import alias validation in code blocks
#  11. TypeSpec covers all API endpoints
#
# Issue #145: Living Documentation System with Stale Page Detection

set -euo pipefail

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
  echo -e "${YELLOW}Validating documentation sync...${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  ERRORS=""
  WARNINGS=""

  # =============================================================================
  # Check 1: Entity query file count matches documentation
  # =============================================================================
  echo -n "  [1/11] Checking entity query files... "
  # Count query files in src/entities/queries/ (excluding index.ts and test files)
  QUERY_FILE_COUNT=$(find src/entities/queries -name "*.ts" ! -name "*.test.ts" ! -name "index.ts" 2> /dev/null | wc -l | tr -d ' ')

  # Count query files listed in AGENTS.md between entities/ and lambdas/ sections
  # Each query file is listed with │   │       ├── or │   │       └──
  DOCUMENTED_QUERY_COUNT=$(awk '/entities\/.*query functions/,/lambdas\/.*Lambda/' AGENTS.md 2> /dev/null | grep -E '│.*-queries\.ts' | wc -l | tr -d ' ')

  if [ "$QUERY_FILE_COUNT" -ne "$DOCUMENTED_QUERY_COUNT" ]; then
    echo -e "${RED}MISMATCH${NC}"
    ERRORS="$ERRORS\n  - Query file count: found $QUERY_FILE_COUNT files in src/entities/queries/, documented $DOCUMENTED_QUERY_COUNT in AGENTS.md"
  else
    echo -e "${GREEN}OK${NC} ($QUERY_FILE_COUNT query files)"
  fi

  # =============================================================================
  # Check 2: Lambda count matches documentation
  # =============================================================================
  echo -n "  [2/11] Checking Lambda count... "
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
  echo -n "  [3/11] Checking MCP rule count... "
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
  echo -n "  [4/11] Checking documented paths exist... "
  PATHS_OK=true

  REQUIRED_PATHS=(
    "src/lib/vendor/AWS"
    "src/lib/vendor/BetterAuth"
    "src/lib/vendor/Drizzle"
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
  echo -n "  [5/11] Checking for stale patterns... "
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
  echo -n "  [6/11] Checking GraphRAG metadata... "
  GRAPHRAG_OK=true

  # Get query file names from entities/queries/ directory
  FS_QUERY_FILES=$(find src/entities/queries -name "*-queries.ts" -exec basename {} .ts \; 2> /dev/null | sort)

  # Check each query module is represented in metadata.json entityRelationships
  # The metadata has entity names like "Users", "Files" - we check those exist
  for query_file in $FS_QUERY_FILES; do
    # Map query files to expected entities (e.g., user-queries -> Users)
    case "$query_file" in
      user-queries) expected="Users" ;;
      file-queries) expected="Files" ;;
      device-queries) expected="Devices" ;;
      session-queries) expected="Sessions" ;;
      relationship-queries) expected="UserFiles" ;;
      *) expected="" ;;
    esac

    if [ -n "$expected" ] && ! grep -q "\"$expected\"" graphrag/metadata.json 2> /dev/null; then
      WARNINGS="$WARNINGS\n  - Entity '$expected' (from $query_file.ts) not found in graphrag/metadata.json"
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
  echo -n "  [7/11] Checking wiki links... "
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
    echo -e "${RED}BROKEN LINKS${NC}"
    ERRORS="$ERRORS$BROKEN_LINKS"
  fi

  # =============================================================================
  # Check 8: Documentation structure (markdown in wiki/, machine files in root)
  # =============================================================================
  echo -n "  [8/11] Checking docs/ structure... "
  DOCS_OK=true

  # Allowed files in docs/ root
  ALLOWED_ROOT_FILES=(
    "doc-code-mapping.json"
    "doc-code-mapping.schema.json"
    "llms.txt"
    "llms-full.txt"
    "terraform.md"
  )

  # Allowed subdirectories in docs/
  ALLOWED_SUBDIRS=("wiki" "api" "source")

  # Check files in docs/ root
  for file in docs/*; do
    [ ! -e "$file" ] && continue
    basename=$(basename "$file")

    if [ -f "$file" ]; then
      # Check if file is in allowed list
      is_allowed=false
      for allowed in "${ALLOWED_ROOT_FILES[@]}"; do
        if [ "$basename" = "$allowed" ]; then
          is_allowed=true
          break
        fi
      done

      if [ "$is_allowed" = false ]; then
        if [[ "$basename" == *.md ]]; then
          ERRORS="$ERRORS\n  - Markdown file '$basename' should be in docs/wiki/, not docs/ root"
        else
          WARNINGS="$WARNINGS\n  - Unexpected file '$basename' in docs/ root"
        fi
        DOCS_OK=false
      fi
    elif [ -d "$file" ]; then
      # Check if directory is in allowed list
      is_allowed=false
      for allowed in "${ALLOWED_SUBDIRS[@]}"; do
        if [ "$basename" = "$allowed" ]; then
          is_allowed=true
          break
        fi
      done

      if [ "$is_allowed" = false ]; then
        ERRORS="$ERRORS\n  - Unexpected subdirectory 'docs/$basename/' - move markdown to docs/wiki/"
        DOCS_OK=false
      fi
    fi
  done

  if [ "$DOCS_OK" = true ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}STRUCTURE VIOLATION${NC}"
  fi

  # =============================================================================
  # Check 9: Code path references in wiki docs
  # =============================================================================
  echo -n "  [9/11] Checking code path references... "
  CODE_PATHS_OK=true
  STALE_PATHS=""

  # Check for common stale path patterns in wiki docs
  while IFS= read -r md_file; do
    # Extract backtick-wrapped paths and check if they exist
    while IFS= read -r line_content; do
      # Look for paths that start with common prefixes
      while IFS= read -r path; do
        [ -z "$path" ] && continue

        # Only check paths that look like file/directory references
        if [[ "$path" =~ ^(src|test|util|types|build|graphrag|terraform|bin|scripts)/ ]]; then
          # Check if path exists
          if [ ! -e "$path" ]; then
            STALE_PATHS="$STALE_PATHS\n  - $md_file: stale path '$path'"
            CODE_PATHS_OK=false
          fi
        elif [[ "$path" =~ ^lib/ ]]; then
          # Check for common error: lib/ without src/ prefix
          correct_path="src/$path"
          if [ -e "$correct_path" ]; then
            STALE_PATHS="$STALE_PATHS\n  - $md_file: path '$path' should be '$correct_path'"
            CODE_PATHS_OK=false
          fi
        fi
      done < <(echo "$line_content" | grep -oE '`[^`]+`' | tr -d '`' || true)
    done < <(awk 'BEGIN{c=0; bt=sprintf("%c",96); pat="^" bt bt bt} $0 ~ pat {c=1-c; next} c==0{print}' "$md_file" 2> /dev/null || true)
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  if [ "$CODE_PATHS_OK" = true ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}STALE PATHS${NC} (warning only)"
    WARNINGS="$WARNINGS$STALE_PATHS"
  fi

  # =============================================================================
  # Check 10: Import alias validation in code blocks
  # =============================================================================
  echo -n "  [10/11] Checking import aliases... "
  IMPORTS_OK=true
  STALE_IMPORTS=""

  # Map import alias to actual path (bash 3 compatible)
  get_alias_path() {
    case "$1" in
      "#lib") echo "src/lib" ;;
      "#entities") echo "src/entities" ;;
      "#types") echo "src/types" ;;
      "#test") echo "test" ;;
      "#util") echo "util" ;;
      *) echo "" ;;
    esac
  }

  while IFS= read -r md_file; do
    in_code_block=false

    while IFS= read -r line; do
      if [[ "$line" =~ ^\`\`\`(typescript|ts|javascript|js)?$ ]]; then
        in_code_block=true
        continue
      fi

      if [[ "$line" == '```' ]] && [ "$in_code_block" = true ]; then
        in_code_block=false
        continue
      fi

      if [ "$in_code_block" = true ]; then
        # Look for import statements with aliases
        if [[ "$line" =~ import.*from[[:space:]]+[\'\"]#([a-z]+)/([^\'\"/]*)[\'\"] ]]; then
          alias="#${BASH_REMATCH[1]}"
          import_path="${BASH_REMATCH[2]}"

          alias_base=$(get_alias_path "$alias")
          if [ -n "$alias_base" ]; then
            full_path="$alias_base/$import_path"
            # Check if it's a valid module (file or directory with index)
            if [ ! -f "$full_path.ts" ] && [ ! -f "$full_path/index.ts" ] && [ ! -d "$full_path" ]; then
              STALE_IMPORTS="$STALE_IMPORTS\n  - $md_file: import '$alias/$import_path' may not exist"
              IMPORTS_OK=false
            fi
          fi
        fi
      fi
    done < "$md_file"
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  if [ "$IMPORTS_OK" = true ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}STALE IMPORTS${NC} (warning only)"
    WARNINGS="$WARNINGS$STALE_IMPORTS"
  fi

  # =============================================================================
  # Check 11: TypeSpec covers all API endpoints
  # =============================================================================
  echo -n "  [11/11] Checking TypeSpec endpoint coverage... "
  COVERAGE_OK=true

  # Get API Lambda names from AGENTS.md trigger table (API Gateway triggered)
  API_LAMBDAS=$(awk '/### Lambda Trigger Patterns/,/### Data Access/' AGENTS.md 2> /dev/null |
    grep -E '^\| [A-Z].*API Gateway' |
    awk -F'|' '{print $2}' | tr -d ' ')

  # Get operationIds from TypeSpec-generated OpenAPI
  if [ -f "docs/api/openapi.yaml" ]; then
    TYPESPEC_OPS=$(grep "operationId:" docs/api/openapi.yaml 2> /dev/null |
      sed 's/.*operationId: //' | tr -d ' ')

    for lambda in $API_LAMBDAS; do
      # Convert Lambda name to expected operationId pattern (PascalCase to camelCase)
      # shellcheck disable=SC2001
      expected_op=$(echo "$lambda" | sed 's/^\(.\)/\L\1/')

      if ! echo "$TYPESPEC_OPS" | grep -qi "$expected_op"; then
        WARNINGS="$WARNINGS\n  - Lambda '$lambda' may not have a TypeSpec operationId (expected: $expected_op)"
        COVERAGE_OK=false
      fi
    done

    if [ "$COVERAGE_OK" = true ]; then
      echo -e "${GREEN}OK${NC}"
    else
      echo -e "${YELLOW}INCOMPLETE${NC} (warning only)"
    fi
  else
    echo -e "${YELLOW}SKIPPED${NC} (run pnpm run document-api first)"
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
}

main "$@"
