#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

terraform_files_list="${bin_dir}/../terraform/*.tf"
types_file_path="${bin_dir}/../src/types/terraform.d.ts"
terraform_hcl_file_path="${bin_dir}/../build/terraform.tf"
terraform_json_file_path="${bin_dir}/../build/terraform.json"

echo "terraform_files_list = $terraform_files_list"

echo 'Concatenating Terraform files'
consolidate_command="cat ${terraform_files_list} > ${terraform_hcl_file_path}"
eval $consolidate_command

echo 'Converting HCL to JSON (via hcl2json)'
hcl2json < "$terraform_hcl_file_path" > "$terraform_json_file_path"

echo 'Converting JSON to Typescript (via Quicktype)'
quicktype_command="${bin_dir}/../node_modules/quicktype/dist/index.js ${terraform_json_file_path} -o ${types_file_path}"
eval $quicktype_command

echo 'Prepending Typescript nocheck on file'
printf '%s\n%s\n' "// @ts-nocheck" "$(cat $types_file_path)" > "$types_file_path"
