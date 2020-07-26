#!/bin/sh

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# setup file paths
zip_file_path="${bin_dir}/../build/artifacts/dist.zip"
directory_to_zip="${bin_dir}/../dist"

echo "Running TypeScript checker"
npm run check-types

echo "Building distribution directory"
npm run build

echo "Zipping distribution directory to ${zip_file_path}"
zip -r -X $zip_file_path $directory_to_zip

echo "Updating Terraform plan"
cd "${bin_dir}/../terraform"
terraform apply -auto-approve
