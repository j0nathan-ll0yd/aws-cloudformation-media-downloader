#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# TODO: Check to see if the code has actually been deployed
# aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE | jq -r '.StackSummaries[0].StackName'

source "${bin_dir}/environment-setup.sh"
LIST_STACK_RESOURCES_OUTPUT=`aws cloudformation list-stack-resources --stack-name $STACK_NAME`

# get the Amazon Rest API gateway ID
export SUBDOMAIN=`echo $LIST_STACK_RESOURCES_OUTPUT | jq '.StackResourceSummaries[] | select(.ResourceType == "AWS::ApiGateway::RestApi")' | jq -r '.PhysicalResourceId'`
echo "AWS API Gateway Subdomain: ${SUBDOMAIN}"

export STAGE=`echo $LIST_STACK_RESOURCES_OUTPUT | jq '.StackResourceSummaries[] | select(.ResourceType == "AWS::ApiGateway::Stage")' | jq -r '.PhysicalResourceId'`
echo "AWS API Gateway Stage: ${STAGE}"

export API_RESOURCE_ID=`echo $LIST_STACK_RESOURCES_OUTPUT | jq '.StackResourceSummaries[] | select(.ResourceType == "AWS::ApiGateway::ApiKey")' | jq -r '.PhysicalResourceId'`
echo "AWS API Gateway API Resource ID: ${API_RESOURCE_ID}"

export API_KEY=`aws apigateway get-api-key --api-key ${API_RESOURCE_ID} --include-value | jq -r '.value'`
echo "AWS API Gateway API Key: ${API_KEY}"

echo "AWS API Region: ${AWS_REGION}"
