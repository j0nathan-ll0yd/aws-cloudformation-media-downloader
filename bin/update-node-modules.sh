#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/environment-setup.sh"
source "${bin_dir}/deployment-setup.sh"

# TODO: Add the command to automatically use only production node_modules
# npm install --only=prod

cd "$bin_dir/../"
temp_node_modules="build/nodejs/node_modules"
node_modules_path="node_modules"
node_modules_artifact_path_prev="${ARTIFACT_DIR}/${S3_KEY_NODE_MODULES_ZIP}"
node_modules_artifact_path_next="${ARTIFACT_DIR}/layer-node-modules-next.zip"
export NODE_MODULES_ARTIFACT_PATH=$node_modules_artifact_path_prev

artifact_path=$node_modules_artifact_path_next
if [ ! -f $node_modules_artifact_path_prev ]; then
  # If there was no previous artifact, there is nothing to compare
   artifact_path=$node_modules_artifact_path_prev
fi

echo "Moving node_modules directory"
rm -rf build/nodejs
mkdir build/nodejs
mv node_modules build/nodejs/
cd "build"

echo "Zipping node_modules directory to ${artifact_path}"
time zip -rqX ${artifact_path} nodejs
time mv nodejs/node_modules ../node_modules

node_modules_sha1=($(sha1sum ${artifact_path}))
echo "Created node_modules artifact (${artifact_path})"
echo "Generated sha1sum (${node_modules_sha1})"

if ([ -f $node_modules_artifact_path_prev ] && [ -f $node_modules_artifact_path_next ]); then
  # If there was no previous artifact, there is nothing to compare
   hash_next=($(sha1sum ${node_modules_artifact_path_next}))
   hash_prev=($(sha1sum ${node_modules_artifact_path_prev}))
fi

echo "Comparing node_module versions"
if [ $hash_next != $hash_prev ]; then
  mv ${node_modules_artifact_path_next} ${node_modules_artifact_path_prev}
  echo "Updating node_modules layer"
  echo "Updating zip to S3"
  # possible error: upload failed: artifacts/layer-node-modules.zip to s3://lifegames-app-artifacts/layer-node-modules.zip An error occurred (NoSuchBucket) when calling the CreateMultipartUpload operation: The specified bucket does not exist
  aws --region ${AWS_REGION} s3 cp ${node_modules_artifact_path_prev} s3://${DEPLOYMENT_BUCKET}

  echo "Updating layer"
  # possible error: An error occurred (RequestEntityTooLargeException) when calling the PublishLayerVersion operation: Request must be smaller than 69905067 bytes for the PublishLayerVersion operation
  layer_version_arn=`aws lambda publish-layer-version --layer-name "NodeModulesLayer" \
  --description "NodeJS module of Moment JS library" \
  --license-info "MIT" \
  --compatible-runtimes "nodejs8.10" \
  --zip-file "fileb:///${node_modules_artifact_path_prev}" | jq -r '.LayerVersionArn'`

  # refresh functions
  functions_to_update=`aws lambda list-functions | jq -r '.Functions[] | .FunctionName' | grep "${STACK_NAME}-"`

  echo "Updating functions"
  for function_name in $functions_to_update
  do
    echo "Updating function ${function_name}"
    aws lambda update-function-configuration \
      --function-name ${function_name} \
      --layers $layer_version_arn | jq -r '.FunctionName' | echo "Updated $(</dev/stdin)" &
  done
  wait

  echo "Update complete!"
fi
