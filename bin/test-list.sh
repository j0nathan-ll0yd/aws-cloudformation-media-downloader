#!/usr/bin/env bash
# Script: test-list.sh
# Purpose: Test the ListFiles API endpoint
# Usage: ./bin/test-list.sh --env <staging|production>

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
      echo "Usage: ./bin/test-list.sh --env <staging|production>"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
  echo "ERROR: --env parameter is required"
  echo "Usage: ./bin/test-list.sh --env <staging|production>"
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

  local REQUEST_URL="https://${subdomain}.execute-api.us-west-2.amazonaws.com/${stage}/files?ApiKey=${api_key}"
  echo -e "${GREEN}▶${NC} Calling ${REQUEST_URL}"
  curl -v -H "Content-Type: application/json" \
    -H "User-Agent: localhost@lifegames" \
    -H "Accept: application/json" \
    "$REQUEST_URL" | jq
}

main "$@"
