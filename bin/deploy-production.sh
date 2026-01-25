#!/usr/bin/env bash
#
# Deploy to production environment.
# Requires explicit confirmation unless --auto-approve is passed.
#
# For CI/CD, use --auto-approve flag.
# For local deploys, review the plan and apply manually.
#
# Usage:
#   ./bin/deploy-production.sh [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/terraform"

# Verify workspace
CURRENT_WS=$(tofu workspace show)
if [[ "$CURRENT_WS" != "production" ]]; then
  echo "Switching to production workspace..."
  tofu workspace select production
fi

# Load environment variables if .env exists
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  source "${PROJECT_ROOT}/.env"
  set +a
fi

echo "Running plan for production..."
tofu plan -var-file=environments/production.tfvars -out=tfplan

if [[ "${1:-}" == "--auto-approve" ]]; then
  echo "Applying to production..."
  tofu apply tfplan
  rm -f tfplan
else
  echo ""
  echo "Review the plan above. To apply, run:"
  echo "  cd terraform && tofu apply tfplan"
  echo ""
  echo "Or re-run with --auto-approve flag."
fi
