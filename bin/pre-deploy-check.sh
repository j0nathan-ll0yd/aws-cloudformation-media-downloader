#!/usr/bin/env bash
#
# pre-deploy-check.sh
# Runs tofu plan and validates state before deployment to detect drift
#
# Usage:
#   ./bin/pre-deploy-check.sh          # Check for drift, block if detected
#   ./bin/pre-deploy-check.sh --force  # Check for drift, proceed anyway
#
# Exit codes:
#   0 - No changes detected, safe to deploy
#   1 - tofu plan failed (syntax error, missing provider, etc.)
#   2 - Drift detected, deployment blocked (unless --force)

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

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${BLUE}Pre-Deploy Drift Check${NC}"
  echo "======================="
  echo ""

  # Check for required environment variables
  if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
    echo -e "${RED}ERROR: .env file not found${NC}"
    echo "Ensure .env is symlinked from main repository"
    exit 1
  fi

  # Load environment variables
  set -a
  # shellcheck source=/dev/null
  source "${PROJECT_ROOT}/.env"
  set +a

  # =============================================================================
  # Validate SOPS Secrets
  # =============================================================================
  echo -e "${BLUE}Validating SOPS secrets...${NC}"

  SECRETS_FILE="${PROJECT_ROOT}/secrets.enc.yaml"

  if [[ ! -f "${SECRETS_FILE}" ]]; then
    echo -e "${RED}✗${NC} secrets.enc.yaml not found"
    echo "  Encrypted secrets file is required for deployment"
    exit 1
  fi

  # Verify file has SOPS encryption markers
  if ! grep -q "sops:" "${SECRETS_FILE}" 2>/dev/null; then
    echo -e "${RED}✗${NC} secrets.enc.yaml does not appear to be SOPS-encrypted"
    echo "  File should contain 'sops:' metadata section"
    exit 1
  fi

  echo -e "${GREEN}✓${NC} SOPS secrets file validated"
  echo ""

  # =============================================================================
  # Verify Terraform Backend
  # =============================================================================
  echo -e "${BLUE}Checking Terraform backend...${NC}"

  if [[ ! -f "${TERRAFORM_DIR}/backend.tf" ]]; then
    echo -e "${RED}ERROR: backend.tf not found${NC}"
    echo "Remote state backend configuration is required"
    exit 1
  fi

  echo -e "${GREEN}✓${NC} Remote backend configured (backend.tf)"

  # Ensure terraform is initialized with the backend
  cd "${TERRAFORM_DIR}"
  if [[ ! -d ".terraform" ]]; then
    echo "  Initializing backend..."
    if ! tofu init -input=false > /dev/null 2>&1; then
      echo -e "${RED}ERROR: Failed to initialize terraform backend${NC}"
      exit 1
    fi
  fi
  echo "  State backend: S3 (remote)"
  echo ""

  # Run tofu plan with detailed exit code
  echo -e "${YELLOW}Running tofu plan...${NC}"
  cd "${TERRAFORM_DIR}"

  # Capture plan output and exit code
  set +e
  PLAN_OUTPUT=$(tofu plan -detailed-exitcode -input=false -no-color 2>&1)
  PLAN_EXIT=$?
  set -e

  case $PLAN_EXIT in
    0)
      echo ""
      echo -e "${GREEN}No changes detected.${NC}"
      echo "Infrastructure matches configuration. Safe to deploy."
      echo ""
      ;;
    1)
      echo ""
      echo -e "${RED}ERROR: tofu plan failed${NC}"
      echo ""
      echo "$PLAN_OUTPUT"
      echo ""
      echo "Fix the errors above before deploying."
      exit 1
      ;;
    2)
      echo ""
      echo -e "${YELLOW}DRIFT DETECTED: Changes required${NC}"
      echo ""
      echo "$PLAN_OUTPUT" | grep -E "^(  #|Plan:)" || echo "$PLAN_OUTPUT"
      echo ""

      # Count additions, changes, deletions
      ADD_COUNT=$(echo "$PLAN_OUTPUT" | grep -c "will be created" || echo 0)
      CHANGE_COUNT=$(echo "$PLAN_OUTPUT" | grep -c "will be updated" || echo 0)
      DESTROY_COUNT=$(echo "$PLAN_OUTPUT" | grep -c "will be destroyed" || echo 0)

      echo "Summary: +${ADD_COUNT} to add, ~${CHANGE_COUNT} to change, -${DESTROY_COUNT} to destroy"
      echo ""

      if [[ "${1:-}" == "--force" ]]; then
        echo -e "${YELLOW}--force flag set, proceeding with deployment...${NC}"
        exit 0
      else
        echo -e "${RED}Deployment blocked.${NC}"
        echo ""
        echo "Review the changes above. To proceed anyway, run:"
        echo "  pnpm run deploy:force"
        echo ""
        echo "Or to investigate the drift:"
        echo "  cd terraform && tofu plan"
        exit 2
      fi
      ;;
    *)
      echo -e "${RED}ERROR: Unexpected exit code from tofu plan: ${PLAN_EXIT}${NC}"
      echo "$PLAN_OUTPUT"
      exit 1
      ;;
  esac
}

main "$@"
