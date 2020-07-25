#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

cd "${bin_dir}/../terraform"
subdomain=`terraform output api_gateway_subdomain`
region=`terraform output api_gateway_region`
stage=`terraform output api_gateway_stage`
api_key=`terraform output api_gateway_api_key`

data_file_path="${bin_dir}/../test/fixtures/handleRegisterDevice/APIGatewayEvent.json"
REQUEST_DATA=`cat ${data_file_path} | jq -r '.body'`
REQUEST_URL="https://${subdomain}.execute-api.${region}.amazonaws.com/${stage}/registerDevice?ApiKey=${api_key}"
echo "Calling ${REQUEST_URL}"
curl -X POST -v -H "Content-Type: application/json" \
-H "Accept: application/json" \
--data "${REQUEST_DATA}" \
$REQUEST_URL | jsonpp

