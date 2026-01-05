#!/usr/bin/env bash
# Script: test-list.sh
# Purpose: Test the ListFiles API endpoint
# Usage: pnpm run test-remote-list or ./bin/test-list.sh

set -euo pipefail

# Color definitions
RED='\033[0;31m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

main() {
  cd "${PROJECT_ROOT}/terraform"
  local domain
  local api_key
  domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
  api_key=$(tofu output api_gateway_api_key | tr -d '"')

  local REQUEST_URL="https://${domain}/files?ApiKey=${api_key}"
  echo "Calling ${REQUEST_URL}"
  curl -v -H "Content-Type: application/json" \
    -H "User-Agent: localhost@lifegames" \
    -H "Accept: application/json" \
    "$REQUEST_URL" | jq
}

main "$@"
