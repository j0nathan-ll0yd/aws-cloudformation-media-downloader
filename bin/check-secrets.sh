#!/usr/bin/env bash
# check-secrets.sh - Detect potential secrets in staged files
#
# Purpose: Pre-commit hook to prevent accidental secret commits
# Usage: pnpm run check-secrets
#        Or automatically via .husky/pre-commit
#
# This script checks for:
# 1. secrets.yaml being staged (should never be committed)
# 2. Patterns that look like hardcoded secrets

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}ERROR:${NC} $1" >&2
}

# Warning handler
warn() {
  echo -e "${YELLOW}WARNING:${NC} $1" >&2
}

# Success handler
success() {
  echo -e "${GREEN}OK:${NC} $1"
}

check_staged_files() {
  local staged_files
  staged_files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")

  if [ -z "$staged_files" ]; then
    success "No staged files to check"
    return 0
  fi

  local found_secrets=0

  # Check 1: secrets.yaml should never be staged
  if echo "$staged_files" | grep -q "^secrets\.yaml$"; then
    error "secrets.yaml is staged for commit!"
    echo ""
    echo "This file contains unencrypted secrets and should never be committed."
    echo "The encrypted version (secrets.enc.yaml) is safe to commit."
    echo ""
    echo "To unstage: git reset HEAD secrets.yaml"
    echo ""
    found_secrets=1
  fi

  # Check 2: Any .yaml files in secure/ directory
  if echo "$staged_files" | grep -qE "^secure/.*\.(yaml|yml|json|pem|p12|key)$"; then
    error "Sensitive file from secure/ directory is staged!"
    echo ""
    echo "Files in secure/ should never be committed."
    echo ""
    found_secrets=1
  fi

  # Check 3: Cookie files
  if echo "$staged_files" | grep -qE "youtube-cookies\.txt$"; then
    error "YouTube cookies file is staged!"
    echo ""
    echo "Cookie files contain session data and should never be committed."
    echo ""
    found_secrets=1
  fi

  # Check 4: .env files (except .env.example)
  if echo "$staged_files" | grep -qE "^\.env$|^\.env\.local$|^\.env\.production$"; then
    error ".env file is staged for commit!"
    echo ""
    echo "Environment files may contain secrets. Use .env.example for templates."
    echo ""
    found_secrets=1
  fi

  # Check 5: Scan for potential hardcoded secrets in text files
  for file in $staged_files; do
    if [ -f "${PROJECT_ROOT}/${file}" ]; then
      # Skip binary files, encrypted files, and test fixtures
      if file "${PROJECT_ROOT}/${file}" 2>/dev/null | grep -q "text" && \
         ! echo "$file" | grep -qE "\.(enc|encrypted)\." && \
         ! echo "$file" | grep -qE "^test/fixtures/"; then

        # Pattern: Potential API keys or tokens (long alphanumeric strings after common key names)
        if grep -nE "(api[_-]?key|api[_-]?token|secret[_-]?key|private[_-]?key|auth[_-]?token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{32,}['\"]" \
             "${PROJECT_ROOT}/${file}" 2>/dev/null | \
           grep -vE "(placeholder|example|test|mock|fake|dummy|YOUR_)" > /dev/null; then
          warn "Potential hardcoded secret in $file"
          found_secrets=1
        fi

        # Pattern: AWS access keys
        if grep -nE "AKIA[A-Z0-9]{16}" "${PROJECT_ROOT}/${file}" 2>/dev/null > /dev/null; then
          error "AWS Access Key ID found in $file"
          found_secrets=1
        fi

        # Pattern: GitHub tokens
        if grep -nE "ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}" "${PROJECT_ROOT}/${file}" 2>/dev/null | \
           grep -vE "(test|mock|fake)" > /dev/null; then
          error "GitHub token found in $file"
          found_secrets=1
        fi
      fi
    fi
  done

  if [ $found_secrets -eq 1 ]; then
    echo ""
    echo "Secret detection found potential issues."
    echo ""
    echo "If these are false positives, you can bypass with:"
    echo "  git commit --no-verify"
    echo ""
    return 1
  fi

  success "No secrets detected in staged files"
  return 0
}

main() {
  echo "Checking for secrets in staged files..."
  check_staged_files
}

main "$@"
