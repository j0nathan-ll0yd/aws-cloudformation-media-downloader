#!/usr/bin/env bash
set -euo pipefail

# Get the directory of this file (where the package.json file is located)
bin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null 2>&1 && pwd)"
project_root="${bin_dir}/.."

# Load environment variables from .env if it exists
if [ -f "${project_root}/.env" ]; then
  set -a
  source "${project_root}/.env"
  set +a
fi

infrastructure_files_list="${project_root}/terraform/*.tf"
types_file_path="${project_root}/src/types/infrastructure.d.ts"
infrastructure_hcl_file_path="${project_root}/build/infrastructure.tf"
infrastructure_json_file_path="${project_root}/build/infrastructure.json"

echo "infrastructure_files_list = $infrastructure_files_list"

echo 'Concatenating infrastructure files'
cat ${infrastructure_files_list} > "${infrastructure_hcl_file_path}"

echo 'Converting HCL to JSON (via hcl2json)'
hcl2json < "$infrastructure_hcl_file_path" > "$infrastructure_json_file_path"

echo 'Converting JSON to TypeScript (via Quicktype)'
node "${project_root}/node_modules/quicktype/dist/index.js" "${infrastructure_json_file_path}" -o "${types_file_path}"

echo 'Checking Secrets (secrets.yaml) via SOPS'
secrets_file_path="${project_root}/secrets.yaml"
encrypted_secrets_file_path="${project_root}/secrets.enc.yaml"
sops_config_path="${project_root}/.sops.yaml"

if [ ! -f "$secrets_file_path" ]; then
  echo "Warning: Secrets file does not exist at $secrets_file_path"
  echo "Please refer to the README for setup instructions"
  echo "Skipping encryption step"
elif [ ! -f "$sops_config_path" ]; then
  echo "Warning: SOPS config file does not exist at $sops_config_path"
  echo "Please refer to the README for SOPS configuration instructions"
  echo "Skipping encryption step"
elif grep -q "^sops:" "$secrets_file_path" 2> /dev/null; then
  # Source file is already encrypted (has sops metadata) - skip
  echo "Warning: secrets.yaml appears to already be encrypted - skipping"
  echo "If this is unintentional, decrypt it with: sops --decrypt secrets.yaml > secrets_plain.yaml"
elif [ ! -f "$encrypted_secrets_file_path" ]; then
  # No encrypted file exists yet - encrypt for the first time
  echo "Encrypting secrets for the first time..."
  sops --config "${sops_config_path}" --encrypt --output "${encrypted_secrets_file_path}" "${secrets_file_path}"
else
  # Compare hashes to avoid unnecessary re-encryption (AES-GCM uses random IVs)
  # This requires the age private key to decrypt - skip comparison if unavailable
  source_hash=$(shasum -a 256 "${secrets_file_path}" | cut -d' ' -f1)
  decrypted_content=$(sops --config "${sops_config_path}" --decrypt "${encrypted_secrets_file_path}" 2> /dev/null)
  decrypt_exit_code=$?

  if [ $decrypt_exit_code -ne 0 ]; then
    echo "Cannot decrypt secrets (missing age key?) - skipping encryption"
    echo "To re-encrypt, ensure SOPS_AGE_KEY_FILE is set or key is in ~/.config/sops/age/keys.txt"
  else
    decrypted_hash=$(echo "$decrypted_content" | shasum -a 256 | cut -d' ' -f1)

    if [ "$source_hash" != "$decrypted_hash" ]; then
      echo "Secrets changed - re-encrypting..."
      sops --config "${sops_config_path}" --encrypt --output "${encrypted_secrets_file_path}" "${secrets_file_path}"
    else
      echo "Secrets unchanged - skipping encryption"
    fi
  fi
fi

echo 'Prepending Typescript nocheck on file'
printf '%s\n%s\n' "// @ts-nocheck" "$(cat "$types_file_path")" > "$types_file_path"
