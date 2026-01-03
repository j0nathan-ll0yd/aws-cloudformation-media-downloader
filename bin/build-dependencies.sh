#!/usr/bin/env bash
# Script: build-dependencies.sh
# Purpose: Build Terraform types and encrypt secrets for deployment
# Usage: pnpm run build-dependencies or ./bin/build-dependencies.sh

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

main() {
  # Load environment variables from .env if it exists
  if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
  fi

  local infrastructure_files_list="${PROJECT_ROOT}/terraform/*.tf"
  local types_file_path="${PROJECT_ROOT}/src/types/infrastructure.d.ts"
  local infrastructure_hcl_file_path="${PROJECT_ROOT}/build/infrastructure.tf"
  local infrastructure_json_file_path="${PROJECT_ROOT}/build/infrastructure.json"

  echo "infrastructure_files_list = $infrastructure_files_list"

  echo 'Concatenating infrastructure files'
  cat ${infrastructure_files_list} > "${infrastructure_hcl_file_path}"

  echo 'Converting HCL to JSON (via hcl2json)'
  hcl2json < "$infrastructure_hcl_file_path" > "$infrastructure_json_file_path"

  echo 'Converting JSON to TypeScript (via Quicktype)'
  node "${PROJECT_ROOT}/node_modules/quicktype/dist/index.js" "${infrastructure_json_file_path}" -o "${types_file_path}"

  echo 'Checking Secrets (secrets.yaml) via SOPS'
  local secrets_file_path="${PROJECT_ROOT}/secrets.yaml"
  local encrypted_secrets_file_path="${PROJECT_ROOT}/secrets.enc.yaml"
  local sops_config_path="${PROJECT_ROOT}/.sops.yaml"

  if [ ! -f "$secrets_file_path" ]; then
    echo -e "${YELLOW}Warning:${NC} Secrets file does not exist at $secrets_file_path"
    echo "Please refer to the README for setup instructions"
    echo "Skipping encryption step"
  elif [ ! -f "$sops_config_path" ]; then
    echo -e "${YELLOW}Warning:${NC} SOPS config file does not exist at $sops_config_path"
    echo "Please refer to the README for SOPS configuration instructions"
    echo "Skipping encryption step"
  elif grep -q "^sops:" "$secrets_file_path" 2> /dev/null; then
    # Source file is already encrypted (has sops metadata) - skip
    echo -e "${YELLOW}Warning:${NC} secrets.yaml appears to already be encrypted - skipping"
    echo "If this is unintentional, decrypt it with: sops --decrypt secrets.yaml > secrets_plain.yaml"
  elif [ ! -f "$encrypted_secrets_file_path" ]; then
    # No encrypted file exists yet - encrypt for the first time
    echo "Encrypting secrets for the first time..."
    sops --config "${sops_config_path}" --encrypt --output "${encrypted_secrets_file_path}" "${secrets_file_path}"
  else
    # Compare hashes to avoid unnecessary re-encryption (AES-GCM uses random IVs)
    # This requires the age private key to decrypt - skip comparison if unavailable
    local source_hash
    local decrypted_content
    local decrypt_exit_code
    source_hash=$(shasum -a 256 "${secrets_file_path}" | cut -d' ' -f1)
    decrypted_content=$(sops --config "${sops_config_path}" --decrypt "${encrypted_secrets_file_path}" 2> /dev/null) || true
    decrypt_exit_code=$?

    if [ $decrypt_exit_code -ne 0 ]; then
      echo "Cannot decrypt secrets (missing age key?) - skipping encryption"
      echo "To re-encrypt, ensure SOPS_AGE_KEY_FILE is set or key is in ~/.config/sops/age/keys.txt"
    else
      local decrypted_hash
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
}

main "$@"
