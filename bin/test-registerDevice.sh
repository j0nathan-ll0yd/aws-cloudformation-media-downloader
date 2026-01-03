#!/usr/bin/env bash
# Script: test-registerDevice.sh
# Purpose: Test the RegisterDevice API endpoint with synthetic device data
# Usage: pnpm run test-remote-registerDevice or ./bin/test-registerDevice.sh

set -euo pipefail

# Color definitions
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

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

main() {
  cd "${PROJECT_ROOT}/terraform"
  local domain
  local api_key
  domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
  api_key=$(tofu output api_gateway_api_key | tr -d '"')

  local REQUEST_URL="https://${domain}/registerDevice?ApiKey=${api_key}"
  echo "Calling ${REQUEST_URL}"

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
