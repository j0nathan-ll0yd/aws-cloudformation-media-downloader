#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

cd "${bin_dir}/../terraform"
domain=`terraform output cloudfront_distribution_domain`
api_key=`terraform output api_gateway_api_key`

REQUEST_URL="https://${domain}/feedly?ApiKey=${api_key}"
echo "Calling ${REQUEST_URL}"
curl -v -H "Content-Type: application/json" \
-H "Accept: application/json" \
--data @./../src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json \
$REQUEST_URL | python -m json.tool

