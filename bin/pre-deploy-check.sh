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

  # Check if state file exists
  if [[ ! -f "${TERRAFORM_DIR}/terraform.tfstate" ]] && [[ ! -L "${TERRAFORM_DIR}/terraform.tfstate" ]]; then
    echo -e "${RED}ERROR: terraform.tfstate not found${NC}"
    echo ""
    echo "Expected location: ${TERRAFORM_DIR}/terraform.tfstate"
    echo ""
    echo "If this is a worktree, ensure state is symlinked from main repository."
    echo "Run: ln -s /path/to/main/repo/terraform/terraform.tfstate ${TERRAFORM_DIR}/terraform.tfstate"
    exit 1
  fi

  # Verify state file is readable
  if [[ -L "${TERRAFORM_DIR}/terraform.tfstate" ]]; then
    STATE_TARGET=$(readlink "${TERRAFORM_DIR}/terraform.tfstate")
    if [[ ! -f "${STATE_TARGET}" ]]; then
      echo -e "${RED}ERROR: State file symlink target does not exist${NC}"
      echo "Symlink points to: ${STATE_TARGET}"
      exit 1
    fi
    RESOURCE_COUNT=$(grep -c '"type":' "${STATE_TARGET}" 2> /dev/null || echo "0")
    echo "State file: symlinked (${RESOURCE_COUNT} resources)"
  else
    RESOURCE_COUNT=$(grep -c '"type":' "${TERRAFORM_DIR}/terraform.tfstate" 2> /dev/null || echo "0")
    echo "State file: local (${RESOURCE_COUNT} resources)"
  fi

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
