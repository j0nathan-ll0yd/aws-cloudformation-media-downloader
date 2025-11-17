#!/usr/bin/env bash

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

terraform_files_list="${bin_dir}/../terraform/*.tf"
types_file_path="${bin_dir}/../src/types/terraform.d.ts"
terraform_hcl_file_path="${bin_dir}/../build/terraform.tf"
terraform_json_file_path="${bin_dir}/../build/terraform.json"

echo "terraform_files_list = $terraform_files_list"

echo 'Concatenating infrastructure files'
consolidate_command="cat ${terraform_files_list} > ${terraform_hcl_file_path}"
eval $consolidate_command

echo 'Converting HCL to JSON (via hcl2json)'
hcl2json < "$terraform_hcl_file_path" > "$terraform_json_file_path"

echo 'Converting JSON to TypeScript (via Quicktype)'
quicktype_command="${bin_dir}/../node_modules/quicktype/dist/index.js ${terraform_json_file_path} -o ${types_file_path}"
eval $quicktype_command

echo 'Encrypting Secrets (secrets.yaml) via SOPS'
secrets_file_path="${bin_dir}/../secrets.yaml"
encrypted_secrets_file_path="${bin_dir}/../secrets.enc.yaml"
sops_config_path="${bin_dir}/../.sops.yaml"

if [ ! -f "$secrets_file_path" ]; then
    echo "Warning: Secrets file does not exist at $secrets_file_path"
    echo "Please refer to the README for setup instructions"
    echo "Skipping encryption step"
elif [ ! -f "$sops_config_path" ]; then
    echo "Warning: SOPS config file does not exist at $sops_config_path"
    echo "Please refer to the README for SOPS configuration instructions"
    echo "Skipping encryption step"
else
    encrypt_command="sops --config ${sops_config_path} --encrypt --output ${encrypted_secrets_file_path} ${secrets_file_path}"
    eval $encrypt_command
fi

echo 'Prepending Typescript nocheck on file'
printf '%s\n%s\n' "// @ts-nocheck" "$(cat $types_file_path)" > "$types_file_path"
