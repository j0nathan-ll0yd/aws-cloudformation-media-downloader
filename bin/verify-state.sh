#!/usr/bin/env bash
#
# verify-state.sh
# Verifies Terraform state consistency after deployment
#
# Usage:
#   ./bin/verify-state.sh --env staging              # Quick verification for staging
#   ./bin/verify-state.sh --env production           # Quick verification for production
#   ./bin/verify-state.sh --env staging --refresh    # Refresh state and verify (slower)
#
# Arguments:
#   --env <environment>  Required. Either 'staging' or 'production'
#   --refresh            Optional. Refresh state before verification (slower but more accurate)
#
# This script:
#   1. Selects the appropriate workspace
#   2. Counts resources in state
#   3. Optionally refreshes state to sync with AWS reality
#   4. Runs tofu plan to check for drift
#   5. Reports any discrepancies

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENVIRONMENT=""
REFRESH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --refresh)
      REFRESH=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      echo "Usage: $0 --env <staging|production> [--refresh]"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
  echo -e "${RED}ERROR: --env parameter is required${NC}"
  echo "Usage: $0 --env <staging|production> [--refresh]"
  exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo -e "${RED}ERROR: Environment must be 'staging' or 'production', got: ${ENVIRONMENT}${NC}"
  exit 1
fi

# Map environment to workspace and tfvars
case $ENVIRONMENT in
  staging)
    WORKSPACE="staging"
    TFVARS_FILE="environments/staging.tfvars"
    ;;
  production)
    WORKSPACE="production"
    TFVARS_FILE="environments/production.tfvars"
    ;;
esac

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${BLUE}Terraform State Verification${NC}"
  echo "=============================="
  echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
  echo ""

  # Load environment variables
  if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${PROJECT_ROOT}/.env"
    set +a
  fi

  cd "${TERRAFORM_DIR}"

  # =============================================================================
  # Select Workspace
  # =============================================================================
  echo -e "${BLUE}Selecting workspace: ${WORKSPACE}${NC}"

  CURRENT_WS=$(tofu workspace show 2>/dev/null || echo "")
  if [[ "$CURRENT_WS" != "$WORKSPACE" ]]; then
    if ! tofu workspace select "$WORKSPACE" > /dev/null 2>&1; then
      echo -e "${RED}ERROR: Failed to select workspace '${WORKSPACE}'${NC}"
      echo "  Run './bin/init-workspaces.sh' to create workspaces"
      exit 1
    fi
  fi
  echo -e "${GREEN}✓${NC} Workspace: ${WORKSPACE}"
  echo ""

  # Count resources in state
  echo -e "${YELLOW}[1/3] Analyzing state file...${NC}"

  AWS_RESOURCES=$(tofu state list 2> /dev/null | grep -cE "^aws_" || echo 0)
  DATA_SOURCES=$(tofu state list 2> /dev/null | grep -cE "^data\." || echo 0)
  LOCAL_RESOURCES=$(tofu state list 2> /dev/null | grep -cE "^local_" || echo 0)

  echo "  AWS resources:   ${AWS_RESOURCES}"
  echo "  Data sources:    ${DATA_SOURCES}"
  echo "  Local resources: ${LOCAL_RESOURCES}"
  echo ""

  # Optional: Refresh state
  if [[ "$REFRESH" == "true" ]]; then
    echo -e "${YELLOW}[2/3] Refreshing state (syncing with AWS)...${NC}"
    tofu refresh -var-file="${TFVARS_FILE}" -input=false > /dev/null 2>&1 || {
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

  # Use mktemp for portable temporary file creation
  PLAN_OUTPUT=$(mktemp)
  trap 'rm -f "$PLAN_OUTPUT"' EXIT

  set +e
  tofu plan -var-file="${TFVARS_FILE}" -detailed-exitcode -input=false -no-color > "$PLAN_OUTPUT" 2>&1
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
      cat "$PLAN_OUTPUT"
      exit 1
      ;;
    2)
      echo ""
      echo -e "${YELLOW}WARNING: Drift detected${NC}"
      echo ""

      # Extract summary
      grep -E "^Plan:" "$PLAN_OUTPUT" || true
      echo ""

      # Show affected resources
      echo "Affected resources:"
      grep -E "^  # " "$PLAN_OUTPUT" | head -20 || true
      echo ""

      echo "Run the following for details:"
      echo "  cd terraform && tofu workspace select ${WORKSPACE} && tofu plan -var-file=${TFVARS_FILE}"
      echo ""
      echo "Or deploy to reconcile:"
      echo "  pnpm run deploy:${ENVIRONMENT}"
      exit 2
      ;;
  esac

  # Summary
  echo "Summary"
  echo "-------"
  echo "  Environment:             ${ENVIRONMENT}"
  echo "  Workspace:               ${WORKSPACE}"
  echo "  Total managed resources: $((AWS_RESOURCES + DATA_SOURCES + LOCAL_RESOURCES))"
  echo "  State backend:           S3 (remote)"
  echo ""
}

main
