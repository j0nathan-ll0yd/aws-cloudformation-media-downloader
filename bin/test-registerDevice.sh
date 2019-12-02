#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/test-setup.sh"

# TODO: Allow for a YouTube URL to be submitted
REQUEST_URL="https://${SUBDOMAIN}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}/registerDevice?ApiKey=${API_KEY}"
echo "Calling ${REQUEST_URL}"
curl -X POST -v -H "Content-Type: application/json" \
-H "Accept: application/json" \
--data @./test/fixtures/handleRegisterDevice/body.json \
$REQUEST_URL | jsonpp

