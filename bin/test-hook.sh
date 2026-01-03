#!/usr/bin/env bash
set -euo pipefail

# Get the directory of this file (where the package.json file is located)
bin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null 2>&1 && pwd)"

cd "${bin_dir}/../terraform"
domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
api_key=$(tofu output api_gateway_api_key | tr -d '"')

REQUEST_URL="https://${domain}/feedly?ApiKey=${api_key}"
echo "Calling ${REQUEST_URL}"
curl -v -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: localhost@lifegames" \
  --data @./../src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json \
  $REQUEST_URL | jq
