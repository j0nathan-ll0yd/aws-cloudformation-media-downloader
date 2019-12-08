#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/test-setup.sh"

LIST_PLATFORM_APPLICATIONS_OUTPUT=`aws sns list-platform-applications`

export APPLICATION_APPLICATION_ARN=`echo $LIST_PLATFORM_APPLICATIONS_OUTPUT | jq '.PlatformApplications[]' | jq -r '.PlatformApplicationArn'`
echo "AWS PlatformApplicationArn: ${APPLICATION_APPLICATION_ARN}"

LIST_ENDPOINTS_OUTPUT=`aws sns list-endpoints-by-platform-application --platform-application-arn $APPLICATION_APPLICATION_ARN`
endpoints_to_update=`echo $LIST_ENDPOINTS_OUTPUT | jq -r '.Endpoints[] | .EndpointArn'`

for endpointArn in $endpoints_to_update
do
  echo "Updating endpoint ${endpointArn}"
  aws sns publish \
    --target-arn $endpointArn \
    --message '{"APNS_SANDBOX":"{\"aps\":{\"content-available\":1},\"key\":\"value\"}"}' \
    --message-attributes '{"AWS.SNS.MOBILE.APNS.PRIORITY":{"DataType":"String","StringValue":"10"}}' \
    --message-structure json
done
wait
