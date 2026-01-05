#!/usr/bin/env bash

# update-agents-prs.sh
# Updates AGENTS.md with recent significant PRs
# Usage: pnpm run update:agents-prs or ./bin/update-agents-prs.sh
#
# This script:
#   1. Fetches last 10 merged PRs via gh CLI
#   2. Filters to significant PRs (feat/fix/refactor)
#   3. Updates the Recent PRs section in AGENTS.md
#   4. Commits changes if in CI mode
#
# Issue #146: CLAUDE.md Evolution

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
  echo -e "${YELLOW}Updating Recent PRs in AGENTS.md...${NC}"

  cd "$PROJECT_ROOT"

  # Check for gh CLI
  if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) is not installed. Install with: brew install gh"
  fi

  # Check if authenticated
  if ! gh auth status &> /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Not authenticated with GitHub CLI${NC}"
    echo "Some features may not work. Run: gh auth login"
  fi

  # Fetch recent merged PRs
  echo "Fetching recent PRs..."
  local PRS
  PRS=$(gh pr list --state merged --limit 10 --json number,title,mergedAt,author --jq '
    .[] |
    select(.title | test("^(feat|fix|refactor|perf|docs)")) |
    "- **#\(.number)**: \(.title) (@\(.author.login), \(.mergedAt | split("T")[0]))"
  ' 2> /dev/null || echo "")

  if [ -z "$PRS" ]; then
    echo -e "${YELLOW}No significant PRs found or gh CLI not authenticated${NC}"
    exit 0
  fi

  # Take only the first 5
  PRS=$(echo "$PRS" | head -5)

  # Generate the section content
  local date_today
  date_today=$(date +%Y-%m-%d)
  local SECTION_CONTENT="## Recent Significant PRs

_Auto-updated by CI - last updated: ${date_today}_

$PRS"

  # Check if section already exists in AGENTS.md
  if grep -q "## Recent Significant PRs" AGENTS.md; then
    echo "Updating existing Recent PRs section..."

    # Create temp file with updated content
    awk -v new_section="$SECTION_CONTENT" '
      BEGIN { in_section = 0 }
      /^## Recent Significant PRs/ {
        print new_section
        in_section = 1
        next
      }
      in_section && /^## / {
        in_section = 0
      }
      !in_section { print }
    ' AGENTS.md > AGENTS.md.tmp

    mv AGENTS.md.tmp AGENTS.md
  else
    echo "Adding new Recent PRs section..."

    # Insert before "## Development Workflow" section
    awk -v new_section="$SECTION_CONTENT" '
      /^## Development Workflow/ {
        print new_section
        print ""
      }
      { print }
    ' AGENTS.md > AGENTS.md.tmp

    mv AGENTS.md.tmp AGENTS.md
  fi

  echo -e "${GREEN}AGENTS.md updated with recent PRs${NC}"

  # In CI mode, commit the changes
  if [ "${CI:-}" = "true" ]; then
    echo "CI mode detected, checking for changes..."
    if git diff --quiet AGENTS.md; then
      echo "No changes to commit"
    else
      echo "Committing AGENTS.md updates..."
      git config --local user.email "github-actions[bot]@users.noreply.github.com"
      git config --local user.name "github-actions[bot]"
      git add AGENTS.md
      # Skip hooks in CI - the commit message is pre-validated and hooks add latency
      git commit --no-verify -m "docs: auto-update AGENTS.md recent PRs section"
      echo -e "${GREEN}Changes committed${NC}"
    fi
  fi
}

main "$@"
