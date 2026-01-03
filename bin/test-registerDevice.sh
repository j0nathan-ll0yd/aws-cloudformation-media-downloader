#!/usr/bin/env bash
set -euo pipefail

# Get the directory of this file
bin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null 2>&1 && pwd)"

cd "${bin_dir}/../terraform"
domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
api_key=$(tofu output api_gateway_api_key | tr -d '"')

REQUEST_URL="https://${domain}/registerDevice?ApiKey=${api_key}"
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
