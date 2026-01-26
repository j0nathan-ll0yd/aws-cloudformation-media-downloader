#!/usr/bin/env bash
# Script: test-registerDevice.sh
# Purpose: Test the RegisterDevice API endpoint with synthetic device data
# Usage: ./bin/test-registerDevice.sh --env <staging|production>

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Parse arguments
ENVIRONMENT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./bin/test-registerDevice.sh --env <staging|production>"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
  echo "ERROR: --env parameter is required"
  echo "Usage: ./bin/test-registerDevice.sh --env <staging|production>"
  exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "ERROR: Environment must be 'staging' or 'production', got: ${ENVIRONMENT}"
  exit 1
fi

main() {
  cd "${PROJECT_ROOT}/terraform"

  echo -e "${GREEN}▶${NC} Selecting ${ENVIRONMENT} workspace..."
  tofu workspace select "${ENVIRONMENT}" > /dev/null

  local subdomain
  local stage
  local api_key
  subdomain=$(tofu output -raw api_gateway_subdomain)
  stage=$(tofu output -raw api_gateway_stage)
  api_key=$(tofu output -raw api_gateway_api_key)

  local REQUEST_URL="https://${subdomain}.execute-api.us-west-2.amazonaws.com/${stage}/device/register?ApiKey=${api_key}"
  echo -e "${GREEN}▶${NC} Calling ${REQUEST_URL}"

  # Fixed synthetic test values - idempotent (same device on each run)
  curl -v -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "User-Agent: localhost@lifegames" \
    -d '{
      "deviceId": "00000000-0000-0000-0000-000000000001",
      "token": "0000000000000000000000000000000000000000000000000000000000000001",
      "name": "RemoteTestDevice",
      "systemName": "iOS",
      "systemVersion": "99.0.0"
    }' \
    "$REQUEST_URL" | jq
}

main "$@"
