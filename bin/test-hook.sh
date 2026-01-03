#!/usr/bin/env bash
# Script: test-hook.sh
# Purpose: Test the Feedly webhook endpoint with sample data
# Usage: pnpm run test-remote-hook or ./bin/test-hook.sh

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

  local REQUEST_URL="https://${domain}/feedly?ApiKey=${api_key}"
  echo "Calling ${REQUEST_URL}"
  curl -v -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "User-Agent: localhost@lifegames" \
    --data @"${PROJECT_ROOT}/src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json" \
    "$REQUEST_URL" | jq
}

main "$@"
