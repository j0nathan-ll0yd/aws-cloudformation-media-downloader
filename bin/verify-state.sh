#!/usr/bin/env bash
#
# verify-state.sh
# Verifies Terraform state consistency after deployment
#
# Usage:
#   ./bin/verify-state.sh              # Quick verification
#   ./bin/verify-state.sh --refresh    # Refresh state and verify (slower but more accurate)
#
# This script:
#   1. Counts resources in state
#   2. Optionally refreshes state to sync with AWS reality
#   3. Runs tofu plan to check for drift
#   4. Reports any discrepancies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Terraform State Verification${NC}"
echo "=============================="
echo ""

# Load environment variables
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  eval export $(cat "${PROJECT_ROOT}/.env")
fi

cd "${TERRAFORM_DIR}"

# Count resources in state
echo -e "${YELLOW}[1/3] Analyzing state file...${NC}"

AWS_RESOURCES=$(tofu state list 2> /dev/null | grep -E "^aws_" | wc -l | tr -d ' ')
DATA_SOURCES=$(tofu state list 2> /dev/null | grep -E "^data\." | wc -l | tr -d ' ')
LOCAL_RESOURCES=$(tofu state list 2> /dev/null | grep -E "^local_" | wc -l | tr -d ' ')

echo "  AWS resources:   ${AWS_RESOURCES}"
echo "  Data sources:    ${DATA_SOURCES}"
echo "  Local resources: ${LOCAL_RESOURCES}"
echo ""

# Optional: Refresh state
if [[ "$1" == "--refresh" ]]; then
  echo -e "${YELLOW}[2/3] Refreshing state (syncing with AWS)...${NC}"
  tofu refresh -input=false > /dev/null 2>&1 || {
    echo -e "${RED}ERROR: State refresh failed${NC}"
    exit 1
  }
  echo -e "${GREEN}  State refreshed successfully${NC}"
  echo ""
else
  echo -e "${YELLOW}[2/3] Skipping refresh (use --refresh for full sync)${NC}"
  echo ""
fi

# Check for drift
echo -e "${YELLOW}[3/3] Checking for configuration drift...${NC}"

set +e
tofu plan -detailed-exitcode -input=false -no-color > /tmp/verify-plan.txt 2>&1
PLAN_EXIT=$?
set -e

case $PLAN_EXIT in
  0)
    echo ""
    echo -e "${GREEN}State verified: No drift detected${NC}"
    echo ""
    echo "Infrastructure matches Terraform configuration."
    ;;
  1)
    echo ""
    echo -e "${RED}ERROR: tofu plan failed${NC}"
    cat /tmp/verify-plan.txt
    rm -f /tmp/verify-plan.txt
    exit 1
    ;;
  2)
    echo ""
    echo -e "${YELLOW}WARNING: Drift detected${NC}"
    echo ""

    # Extract summary
    grep -E "^Plan:" /tmp/verify-plan.txt || true
    echo ""

    # Show affected resources
    echo "Affected resources:"
    grep -E "^  # " /tmp/verify-plan.txt | head -20 || true
    echo ""

    echo "Run 'pnpm run plan' for details, or 'pnpm run deploy' to reconcile."
    rm -f /tmp/verify-plan.txt
    exit 2
    ;;
esac

rm -f /tmp/verify-plan.txt

# Summary
echo "Summary"
echo "-------"
echo "  Total managed resources: $((AWS_RESOURCES + DATA_SOURCES + LOCAL_RESOURCES))"
echo "  State file location: ${TERRAFORM_DIR}/terraform.tfstate"

if [[ -L "${TERRAFORM_DIR}/terraform.tfstate" ]]; then
  echo "  State symlinked to: $(readlink "${TERRAFORM_DIR}/terraform.tfstate")"
fi

echo ""
