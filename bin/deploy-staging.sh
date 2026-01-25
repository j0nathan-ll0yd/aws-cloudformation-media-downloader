#!/usr/bin/env bash
#
# Deploy to staging environment.
# This script is used by local agents for iterative development.
#
# Usage:
#   ./bin/deploy-staging.sh [--plan-only]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
  source "${PROJECT_ROOT}/.env"
  set +a
fi

if [[ "${1:-}" == "--plan-only" ]]; then
  echo "Running plan for staging..."
  tofu plan -var-file=environments/staging.tfvars
else
  echo "Deploying to staging..."
  tofu apply -var-file=environments/staging.tfvars -auto-approve
fi
