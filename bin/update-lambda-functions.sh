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

cd "${bin_dir}/../terraform"
terraform apply -auto-approve
