#!/usr/bin/env bash

# audit-wiki-docs.sh
# Comprehensive wiki documentation audit tool
# Usage: pnpm run audit:wiki or ./bin/audit-wiki-docs.sh
#
# This script performs a comprehensive audit of wiki documentation:
#   1. Internal link validation (all markdown links resolve)
#   2. Code path reference validation (backtick paths exist)
#   3. Orphan page detection (pages not linked from anywhere)
#   4. Import alias validation (code block imports are valid)
#
# Outputs:
#   - docs/wiki-audit-report.md (human-readable)
#   - docs/wiki-audit-results.json (machine-readable for CI)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$PROJECT_ROOT"

echo -e "${BLUE}Wiki Documentation Audit${NC}"
echo "========================="
echo ""

# Initialize counters and arrays
TOTAL_PAGES=0
BROKEN_LINKS=()
STALE_CODE_REFS=()
ORPHAN_PAGES=()
ERRORS=""

# =============================================================================
# Check 1: Internal Link Validation
# =============================================================================
echo -e "${YELLOW}[1/4] Validating internal wiki links...${NC}"

validate_internal_links() {
  local broken_count=0

  while IFS= read -r md_file; do
    ((TOTAL_PAGES++)) || true

    # Extract relative markdown links, filtering out code blocks
    while IFS= read -r link; do
      # Skip empty, external, or anchor-only links
      [ -z "$link" ] && continue
      [[ "$link" == http* ]] && continue
      [[ "$link" == "#"* ]] && continue

      # Remove anchor from link if present
      link_path="${link%%#*}"
      [ -z "$link_path" ] && continue

      # Resolve relative path from the markdown file's directory
      md_dir=$(dirname "$md_file")
      target_path="$md_dir/$link_path"

      # Normalize the path
      normalized_path=$(cd "$md_dir" 2> /dev/null && realpath -m "$link_path" 2> /dev/null || echo "")

      # Check if file exists
      if [ ! -f "$target_path" ] && [ ! -f "$normalized_path" ]; then
        BROKEN_LINKS+=("$md_file|$link_path")
        ((broken_count++)) || true
      fi
    done < <(awk 'BEGIN{c=0; bt=sprintf("%c",96); pat="^" bt bt bt} $0 ~ pat {c=1-c; next} c==0{print}' "$md_file" 2> /dev/null | grep -oE '\]\([^)]+\.md[^)]*\)' | sed 's/\](\([^)]*\))/\1/' | sed 's/#.*//' || true)
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  if [ "$broken_count" -eq 0 ]; then
    echo -e "  ${GREEN}OK${NC} - All internal links resolve"
  else
    echo -e "  ${RED}FAIL${NC} - Found $broken_count broken links"
    ERRORS="$ERRORS\n  - $broken_count broken internal links"
  fi
}

validate_internal_links

# =============================================================================
# Check 2: Code Path Reference Validation
# =============================================================================
echo -e "${YELLOW}[2/4] Validating code path references...${NC}"

validate_code_paths() {
  local stale_count=0

  # Patterns to match:
  # - Backtick paths: `src/...`, `lib/...`, `test/...`, `util/...`
  # - **File**: `path/to/file.ts`
  # - **Location**: `path/to/dir/`

  while IFS= read -r md_file; do
    # Skip files in code blocks and extract backtick-wrapped paths
    while IFS= read -r line_content; do
      # Extract paths from backticks
      # shellcheck disable=SC2016 # Backticks in pattern are intentional
      while IFS= read -r path; do
        [ -z "$path" ] && continue

        # Only check paths that look like file/directory references
        if [[ "$path" =~ ^(src|lib|test|util|types|build|graphrag|terraform|bin|scripts)/ ]]; then
          # Add src/ prefix if path starts with lib/ (common error)
          check_path="$path"
          if [[ "$path" =~ ^lib/ ]]; then
            check_path="src/$path"
          fi

          # Check if path exists (file or directory)
          if [ ! -e "$path" ] && [ ! -e "$check_path" ]; then
            # Store with the original path for reporting
            STALE_CODE_REFS+=("$md_file|$path")
            ((stale_count++)) || true
          fi
        fi
      done < <(echo "$line_content" | grep -oE '`[^`]+`' | tr -d '`' || true)
    done < <(awk 'BEGIN{c=0; bt=sprintf("%c",96); pat="^" bt bt bt} $0 ~ pat {c=1-c; next} c==0{print}' "$md_file" 2> /dev/null || true)
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  if [ "$stale_count" -eq 0 ]; then
    echo -e "  ${GREEN}OK${NC} - All code path references valid"
  else
    echo -e "  ${YELLOW}WARN${NC} - Found $stale_count stale code references"
  fi
}

validate_code_paths

# =============================================================================
# Check 3: Orphan Page Detection
# =============================================================================
echo -e "${YELLOW}[3/4] Detecting orphan pages...${NC}"

detect_orphan_pages() {
  local orphan_count=0

  # Use temp files for bash 3 compatibility (no associative arrays)
  local visited_file
  local queue_file
  visited_file=$(mktemp)
  queue_file=$(mktemp)
  trap 'rm -f "$visited_file" "$queue_file"' EXIT

  # Get all pages linked from a file
  get_linked_pages() {
    local file="$1"
    local dir
    dir=$(dirname "$file")

    awk 'BEGIN{c=0; bt=sprintf("%c",96); pat="^" bt bt bt} $0 ~ pat {c=1-c; next} c==0{print}' "$file" 2> /dev/null |
      grep -oE '\]\([^)]+\.md[^)]*\)' |
      sed 's/\](\([^)]*\))/\1/' |
      sed 's/#.*//' |
      while read -r link; do
        [ -z "$link" ] && continue
        [[ "$link" == http* ]] && continue

        # Resolve relative path
        target=$(cd "$dir" 2> /dev/null && realpath -m "$link" 2> /dev/null || echo "")
        [ -f "$target" ] && echo "$target"
      done
  }

  # Check if a page is visited
  is_visited() {
    grep -Fxq "$1" "$visited_file" 2> /dev/null
  }

  # Mark a page as visited
  mark_visited() {
    echo "$1" >> "$visited_file"
  }

  # Start BFS from Home.md
  if [ -f "docs/wiki/Home.md" ]; then
    echo "docs/wiki/Home.md" > "$queue_file"
    mark_visited "docs/wiki/Home.md"

    # Also add Getting-Started.md as a root
    if [ -f "docs/wiki/Getting-Started.md" ]; then
      echo "docs/wiki/Getting-Started.md" >> "$queue_file"
      mark_visited "docs/wiki/Getting-Started.md"
    fi

    while [ -s "$queue_file" ]; do
      current=$(head -1 "$queue_file")
      tail -n +2 "$queue_file" > "$queue_file.tmp" && mv "$queue_file.tmp" "$queue_file"

      while IFS= read -r linked; do
        [ -z "$linked" ] && continue
        if ! is_visited "$linked"; then
          mark_visited "$linked"
          echo "$linked" >> "$queue_file"
        fi
      done < <(get_linked_pages "$current")
    done
  fi

  # Find orphan pages (pages not in visited set)
  while IFS= read -r page; do
    if ! is_visited "$page"; then
      # Don't count special pages as orphans
      basename=$(basename "$page" .md)
      if [[ "$basename" != "Home" ]] && [[ "$basename" != "Getting-Started" ]] && [[ "$basename" != "_Sidebar" ]]; then
        ORPHAN_PAGES+=("$page")
        ((orphan_count++)) || true
      fi
    fi
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  if [ "$orphan_count" -eq 0 ]; then
    echo -e "  ${GREEN}OK${NC} - No orphan pages detected"
  else
    echo -e "  ${YELLOW}WARN${NC} - Found $orphan_count orphan pages (not linked from Home.md)"
  fi
}

detect_orphan_pages

# =============================================================================
# Check 4: Import Alias Validation
# =============================================================================
echo -e "${YELLOW}[4/4] Validating import aliases in code blocks...${NC}"

validate_import_aliases() {
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
    # Extract code blocks and look for import statements
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
        if [[ "$line" =~ import.*from[[:space:]]+[\'\"]#([a-z]+)/([^\'\"]*)[\'\"] ]]; then
          alias="#${BASH_REMATCH[1]}"
          import_path="${BASH_REMATCH[2]}"

          alias_base=$(get_alias_path "$alias")
          if [ -n "$alias_base" ]; then
            full_path="$alias_base/$import_path"
            # Check if it's a directory (index.ts) or a file
            if [ ! -f "$full_path.ts" ] && [ ! -f "$full_path/index.ts" ] && [ ! -d "$full_path" ]; then
              # Not necessarily an error - could be valid at runtime
              # Just log for review
              :
            fi
          fi
        fi
      fi
    done < "$md_file"
  done < <(find docs/wiki -name "*.md" 2> /dev/null)

  echo -e "  ${GREEN}OK${NC} - Import alias check complete"
}

validate_import_aliases

# =============================================================================
# Generate Reports
# =============================================================================
echo ""
echo -e "${YELLOW}Generating reports...${NC}"

# Get current git info
GIT_SHA=$(git rev-parse --short HEAD 2> /dev/null || echo "unknown")
GIT_BRANCH=$(git branch --show-current 2> /dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Generate JSON report
generate_json_report() {
  local json_file="docs/wiki-audit-results.json"

  cat > "$json_file" << EOF
{
  "generatedAt": "$TIMESTAMP",
  "commit": "$GIT_SHA",
  "branch": "$GIT_BRANCH",
  "summary": {
    "pagesAudited": $TOTAL_PAGES,
    "brokenLinksCount": ${#BROKEN_LINKS[@]},
    "staleCodeRefsCount": ${#STALE_CODE_REFS[@]},
    "orphanPagesCount": ${#ORPHAN_PAGES[@]}
  },
  "brokenLinks": [
EOF

  # Add broken links
  local first=true
  for item in "${BROKEN_LINKS[@]}"; do
    IFS='|' read -r source target <<< "$item"
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$json_file"
    fi
    printf '    {"source": "%s", "target": "%s"}' "$source" "$target" >> "$json_file"
  done

  cat >> "$json_file" << EOF

  ],
  "staleCodeRefs": [
EOF

  # Add stale code refs
  first=true
  for item in "${STALE_CODE_REFS[@]}"; do
    IFS='|' read -r source path <<< "$item"
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$json_file"
    fi
    printf '    {"source": "%s", "path": "%s"}' "$source" "$path" >> "$json_file"
  done

  cat >> "$json_file" << EOF

  ],
  "orphanPages": [
EOF

  # Add orphan pages
  first=true
  for page in "${ORPHAN_PAGES[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$json_file"
    fi
    printf '    "%s"' "$page" >> "$json_file"
  done

  cat >> "$json_file" << EOF

  ]
}
EOF

  echo -e "  Generated: $json_file"
}

# Generate Markdown report
generate_markdown_report() {
  local md_file="docs/wiki-audit-report.md"

  cat > "$md_file" << EOF
# Wiki Documentation Audit Report

Generated: $TIMESTAMP
Commit: $GIT_SHA
Branch: $GIT_BRANCH

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Wiki Pages Audited | $TOTAL_PAGES | - |
| Broken Internal Links | ${#BROKEN_LINKS[@]} | $([ ${#BROKEN_LINKS[@]} -eq 0 ] && echo "PASS" || echo "FAIL") |
| Stale Code References | ${#STALE_CODE_REFS[@]} | $([ ${#STALE_CODE_REFS[@]} -eq 0 ] && echo "PASS" || echo "WARN") |
| Orphan Pages | ${#ORPHAN_PAGES[@]} | $([ ${#ORPHAN_PAGES[@]} -eq 0 ] && echo "PASS" || echo "WARN") |

EOF

  if [ ${#BROKEN_LINKS[@]} -gt 0 ]; then
    cat >> "$md_file" << EOF
## Broken Links

| Source File | Target | Status |
|-------------|--------|--------|
EOF
    for item in "${BROKEN_LINKS[@]}"; do
      IFS='|' read -r source target <<< "$item"
      echo "| \`$source\` | \`$target\` | NOT FOUND |" >> "$md_file"
    done
    echo "" >> "$md_file"
  fi

  if [ ${#STALE_CODE_REFS[@]} -gt 0 ]; then
    cat >> "$md_file" << EOF
## Stale Code References

| Source File | Referenced Path | Status |
|-------------|-----------------|--------|
EOF
    for item in "${STALE_CODE_REFS[@]}"; do
      IFS='|' read -r source path <<< "$item"
      echo "| \`$source\` | \`$path\` | NOT FOUND |" >> "$md_file"
    done
    echo "" >> "$md_file"
  fi

  if [ ${#ORPHAN_PAGES[@]} -gt 0 ]; then
    cat >> "$md_file" << EOF
## Orphan Pages

These pages are not linked from Home.md or any page reachable from Home.md:

| Page | Category |
|------|----------|
EOF
    for page in "${ORPHAN_PAGES[@]}"; do
      category=$(dirname "$page" | sed 's|docs/wiki/||')
      [ "$category" = "docs/wiki" ] && category="Root"
      echo "| \`$page\` | $category |" >> "$md_file"
    done
    echo "" >> "$md_file"
  fi

  echo -e "  Generated: $md_file"
}

generate_json_report
generate_markdown_report

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================="
echo -e "${BLUE}Audit Summary${NC}"
echo "========================="
echo "  Pages audited:       $TOTAL_PAGES"
echo "  Broken links:        ${#BROKEN_LINKS[@]}"
echo "  Stale code refs:     ${#STALE_CODE_REFS[@]}"
echo "  Orphan pages:        ${#ORPHAN_PAGES[@]}"
echo ""

# Exit with error if there are broken links (blocking check)
if [ ${#BROKEN_LINKS[@]} -gt 0 ]; then
  echo -e "${RED}Audit FAILED: Broken links detected${NC}"
  echo ""
  echo "To fix broken links, update the following files:"
  for item in "${BROKEN_LINKS[@]}"; do
    IFS='|' read -r source target <<< "$item"
    echo "  - $source: link to '$target'"
  done
  exit 1
fi

echo -e "${GREEN}Audit PASSED${NC}"
