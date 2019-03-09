#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/environment-setup.sh"
source "${bin_dir}/deployment-setup.sh"

template_path="${build_dir}/../template.yaml"

echo "Deploying CloudFormation Template"
echo "aws cloudformation deploy"
echo "--template-file ${template_path}"
echo "--stack-name ${STACK_NAME}"
echo "--capabilities CAPABILITY_IAM"
echo "--parameter-overrides ContentBucket=${DEPLOYMENT_BUCKET} ContentKey=${S3_KEY_NODE_MODULES_ZIP} CodeKey=${S3_KEY_SOURCE_CODE_ZIP}"

aws cloudformation deploy \
    --template-file ${template_path} \
    --stack-name ${STACK_NAME} \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides ContentBucket=${DEPLOYMENT_BUCKET} ContentKey=${S3_KEY_NODE_MODULES_ZIP} CodeKey=${S3_KEY_SOURCE_CODE_ZIP}
