#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/test-setup.sh"

REQUEST_DATA=`cat test/fixtures/handleRegisterDevice/APIGatewayEvent.json | jq -r '.body'`
REQUEST_URL="https://${SUBDOMAIN}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}/registerDevice?ApiKey=${API_KEY}"
echo "Calling ${REQUEST_URL}"
curl -X POST -v -H "Content-Type: application/json" \
-H "Accept: application/json" \
--data "${REQUEST_DATA}" \
$REQUEST_URL | jsonpp

