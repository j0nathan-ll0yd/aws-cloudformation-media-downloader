#!/usr/bin/env bash
# Extract production fixtures from CloudWatch logs - LOCAL VERSION
# This script replaces the GitHub workflow for manual fixture extraction
#
# Prerequisites:
#   - AWS CLI configured with production credentials
#   - pnpm dependencies installed
#
# Usage:
#   ./bin/extract-production-fixtures.sh [days-back] [create-pr]
#
# Examples:
#   ./bin/extract-production-fixtures.sh                # Extract last 7 days, no PR
#   ./bin/extract-production-fixtures.sh 14             # Extract last 14 days, no PR
#   ./bin/extract-production-fixtures.sh 7 true         # Extract last 7 days and create PR

set -euo pipefail

# Configuration
DAYS_BACK=${1:-7}
CREATE_PR=${2:-false}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  # Change to project root
  cd "${PROJECT_ROOT}"

  echo -e "${BLUE}=== Production Fixture Extraction ===${NC}"
  echo -e "Days to extract: ${YELLOW}${DAYS_BACK}${NC}"
  echo -e "Create PR: ${YELLOW}${CREATE_PR}${NC}"
  echo ""

  # Step 1: Verify AWS credentials
  echo -e "${BLUE}[1/5] Verifying AWS credentials...${NC}"
  if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Please configure AWS CLI with production credentials:"
    echo "  aws configure"
    exit 1
  fi

  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  echo -e "${GREEN}✓${NC} Connected to AWS account: ${ACCOUNT_ID}"

  # Step 2: Extract fixtures from CloudWatch
  echo -e "\n${BLUE}[2/5] Extracting fixtures from CloudWatch...${NC}"
  chmod +x "${SCRIPT_DIR}/extract-fixtures.sh"
  "${SCRIPT_DIR}/extract-fixtures.sh" "${DAYS_BACK}"

  # Step 3: Process fixtures
  echo -e "\n${BLUE}[3/5] Processing fixtures...${NC}"
  # Note: process-fixtures.js was removed; fixture processing now handled by extract-fixtures.sh
  echo -e "${GREEN}✓${NC} Fixtures processed by extract-fixtures.sh"

  # Step 4: Check for changes
  echo -e "\n${BLUE}[4/5] Checking for changes...${NC}"
  if git diff --quiet test/fixtures/api-contracts/; then
    echo -e "${BLUE}➜${NC} No fixture changes detected"
    echo "No updates needed."
    exit 0
  else
    echo -e "${GREEN}✓${NC} Fixture changes detected"

    # Show summary of changes
    echo -e "\n${BLUE}Changed files:${NC}"
    git diff --name-status test/fixtures/api-contracts/ | while read -r status file; do
      case "$status" in
        A) echo -e "  ${GREEN}+ ${file}${NC}" ;;
        M) echo -e "  ${YELLOW}~ ${file}${NC}" ;;
        D) echo -e "  ${RED}- ${file}${NC}" ;;
        *) echo "  ${status} ${file}" ;;
      esac
    done || true
  fi

  # Step 5: Create PR or commit changes
  echo -e "\n${BLUE}[5/5] Finalizing changes...${NC}"

  if [[ "${CREATE_PR}" == "true" ]]; then
    # Create a new branch and PR
    BRANCH_NAME="fixtures/manual-$(date +%Y%m%d-%H%M%S)"

    echo -e "Creating branch: ${YELLOW}${BRANCH_NAME}${NC}"
    git checkout -b "${BRANCH_NAME}"

    # Stage changes
    git add test/fixtures/api-contracts/

    # Commit
    COMMIT_MSG="chore: update fixtures from production CloudWatch logs

Extraction Details:
- Date: $(date)
- Days extracted: ${DAYS_BACK}
- AWS Account: ${ACCOUNT_ID}"

    git commit -m "${COMMIT_MSG}"

    # Push branch
    echo -e "\n${BLUE}Pushing branch...${NC}"
    git push -u origin "${BRANCH_NAME}"

    # Create PR using GitHub CLI if available
    if command -v gh &> /dev/null; then
      echo -e "\n${BLUE}Creating pull request...${NC}"

      PR_BODY="## Automated Fixture Update

This PR contains fixtures extracted from production CloudWatch logs.

### Extraction Details
- **Date**: $(date)
- **Days extracted**: ${DAYS_BACK}
- **AWS Account**: ${ACCOUNT_ID}

### What's Changed
- Production API request/response fixtures updated
- Fixtures deduplicated by structural similarity
- PII and sensitive data redacted

### Review Checklist
- [ ] Verify fixtures match expected API contracts
- [ ] Check that PII/secrets are properly redacted
- [ ] Ensure no breaking changes in API structure
- [ ] Validate fixture quality and completeness

### How to Test
\`\`\`bash
pnpm test
pnpm run test:integration
\`\`\`"

      gh pr create \
        --title "🔄 Manual Fixture Update from Production" \
        --body "${PR_BODY}" \
        --label "fixtures,testing" \
        --draft

      echo -e "${GREEN}✓${NC} Pull request created"
    else
      echo -e "${YELLOW}GitHub CLI not installed. Please create PR manually:${NC}"
      echo "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/pull/new/${BRANCH_NAME}"
    fi
  else
    # Just show the diff
    echo -e "${YELLOW}Changes ready to commit:${NC}"
    echo "To stage changes: git add test/fixtures/api-contracts/"
    echo "To create PR: $0 ${DAYS_BACK} true"
  fi

  echo -e "\n${GREEN}✓${NC} Fixture extraction complete!"
}

main "$@"
