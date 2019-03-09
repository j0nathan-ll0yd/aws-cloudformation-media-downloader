#!/bin/sh

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source "${bin_dir}/environment-setup.sh"
source "${bin_dir}/deployment-setup.sh"
s3_key_name_dist="dist.zip"
zip_path="${ARTIFACT_DIR}/${s3_key_name_dist}"
cd "$bin_dir/../"
compiled_code_path="dist"

# make sure typescript will compile
npm run check-types
# build compliant JS files in the dist directory
npm run build
# zip up the files (exclude OSX dotfiles)
zip -r -X $zip_path $compiled_code_path
# upload to S3
aws s3 cp $zip_path s3://${DEPLOYMENT_BUCKET}
# refresh functions
functions_to_update=`aws lambda list-functions | jq -r '.Functions[] | .FunctionName' | grep "${STACK_NAME}-"`

for function_name in $functions_to_update
do
  echo "Updating function ${function_name}"
  aws lambda update-function-code \
    --function-name ${function_name} \
    --s3-bucket ${DEPLOYMENT_BUCKET} \
    --s3-key ${s3_key_name_dist} | jq -r '.FunctionName' | echo "Updated $(</dev/stdin)" &
done
wait

echo "Update complete!"
