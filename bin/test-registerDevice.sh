#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

cd "${bin_dir}/../terraform"
domain=`terraform output cloudfront_distribution_domain`
api_key=`terraform output api_gateway_api_key`

data_file_path="${bin_dir}/../src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json"
REQUEST_DATA=`cat ${data_file_path} | jq -r '.body'`
REQUEST_URL="https://${domain}/registerDevice?ApiKey=${api_key}"
echo "Calling ${REQUEST_URL}"
curl -X POST -v -H "Content-Type: application/json" \
-H "Accept: application/json" \
--data "${REQUEST_DATA}" \
$REQUEST_URL | jsonpp

