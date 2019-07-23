#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export BIN_DIR=$bin_dir
package_path="${bin_dir}/../package.json"
if [ ! -f $package_path ]; then
   echo "The file '$package_path' was not found."
fi

build_dir="${bin_dir}/../build"
export BUILD_DIR=$build_dir
if [ ! -d "$build_dir" ]; then
  echo "Creating build directory ($build_dir)"
  mkdir ${build_dir}
fi

artifact_dir="${bin_dir}/../build/artifacts"
export ARTIFACT_DIR=$artifact_dir
if [ ! -d "$artifact_dir" ]; then
  echo "Creating artifact directory ($artifact_dir)"
  mkdir ${artifact_dir}
fi

# Extract the project name from the package.json file
export STACK_NAME=`cat ${package_path} | jq -r '.name'`
echo "Preparing to deploy ${STACK_NAME}"

echo "Preparing the S3 bucket for artifacts"
export AWS_REGION=$(aws configure get region) # us-west-2
echo "Getting AWS Account ID"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --output text --query 'Account')
echo "Using AWS Account with ID: ${AWS_ACCOUNT_ID}"
export DEPLOYMENT_BUCKET="${STACK_NAME}-artifacts"

export S3_KEY_SOURCE_CODE_ZIP="dist.zip"
export S3_KEY_NODE_MODULES_ZIP="layer-node-modules.zip"
