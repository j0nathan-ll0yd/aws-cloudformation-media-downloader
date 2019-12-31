#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
file_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
template_path="${file_dir}/../cloudformation/ApiGateway.yaml"
echo "Updating ${template_path}"
epoch_time=`date +%s`
sed -i '' -E "s/MyDeployment([0-9]+)/MyDeployment${epoch_time}/g" ${template_path}
