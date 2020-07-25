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
artifact_dir="${bin_dir}/../build/artifacts"
artifact_path="${artifact_dir}/layer-node-modules.zip"
export NODE_MODULES_ARTIFACT_PATH=artifact_path

echo "Moving node_modules directory"
rm -rf build/nodejs
mkdir build/nodejs
mv node_modules build/nodejs/
cd "build"

echo "Zipping node_modules directory to ${artifact_path}"
time zip -rqX ${artifact_path} nodejs
time mv nodejs/node_modules ../node_modules

cd "${bin_dir}/../terraform"
terraform apply -auto-approve
