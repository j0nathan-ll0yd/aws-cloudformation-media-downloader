#!/usr/bin/env bash
#
# Deploy to staging environment.
# This script is used by local agents for iterative development.
#
# Usage:
#   ./bin/deploy-staging.sh [--plan-only] [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "${PROJECT_ROOT}/terraform"

# Verify workspace
CURRENT_WS=$(tofu workspace show)
if [[ "$CURRENT_WS" != "staging" ]]; then
  echo "Switching to staging workspace..."
  tofu workspace select staging
fi

# Load environment variables if .env exists
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${PROJECT_ROOT}/.env"
  set +a
fi

# Parse arguments
PLAN_ONLY=false
AUTO_APPROVE=false
for arg in "$@"; do
  case $arg in
    --plan-only)
      PLAN_ONLY=true
      ;;
    --auto-approve)
      AUTO_APPROVE=true
      ;;
  esac
done

if [[ "$PLAN_ONLY" == "true" ]]; then
  echo "Running plan for staging..."
  tofu plan -var-file=environments/staging.tfvars
else
  echo -e "${YELLOW}Deploying to staging environment${NC}"
  echo ""

  # Show what will be deployed
  echo "Running plan..."
  tofu plan -var-file=environments/staging.tfvars -out=staging.tfplan
  echo ""

  if [[ "$AUTO_APPROVE" == "true" ]]; then
    echo -e "${GREEN}Auto-approve enabled, applying changes...${NC}"
    tofu apply staging.tfplan
  else
    # Prompt for confirmation
    echo -e "${YELLOW}Review the plan above. Apply these changes to staging?${NC}"
    read -r -p "Type 'yes' to confirm: " CONFIRM

    if [[ "$CONFIRM" == "yes" ]]; then
      echo -e "${GREEN}Applying changes to staging...${NC}"
      tofu apply staging.tfplan
    else
      echo -e "${RED}Deployment cancelled.${NC}"
      rm -f staging.tfplan
      exit 1
    fi
  fi

  # Cleanup plan file
  rm -f staging.tfplan
fi
