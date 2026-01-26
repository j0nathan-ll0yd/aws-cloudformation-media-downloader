#!/usr/bin/env bash
# Script: build-dependencies.sh
# Purpose: Build Terraform types, extract permissions, and encrypt secrets for deployment
# Usage: pnpm run build:dependencies or ./bin/build-dependencies.sh
#
# Execution Order:
# 1. Infrastructure types (HCL → JSON → TypeScript)
# 2. Dependency graph (for permission tracing)
# 3. Terraform resource extraction and enum generation
# 4. Permission extraction (db, entity, service, dynamodb)
# 5. Permission generation (DSQL roles, IAM policies)
# 6. Secrets encryption (SOPS)

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

# Success message
success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Section header
section() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

main() {
  # Load environment variables from .env if it exists
  if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "${PROJECT_ROOT}/.env"
    set +a
  fi

  local infrastructure_files=("${PROJECT_ROOT}"/terraform/*.tf)
  local types_file_path="${PROJECT_ROOT}/src/types/infrastructure.d.ts"
  local infrastructure_hcl_file_path="${PROJECT_ROOT}/build/infrastructure.tf"
  local infrastructure_json_file_path="${PROJECT_ROOT}/build/infrastructure.json"

  # Ensure build directory exists
  mkdir -p "$(dirname "${infrastructure_hcl_file_path}")"

  # ============================================================
  # Phase 1: Infrastructure Types
  # ============================================================
  section "Phase 1: Infrastructure Types"

  echo "infrastructure_files = ${infrastructure_files[*]}"

  echo 'Concatenating infrastructure files'
  cat "${infrastructure_files[@]}" > "${infrastructure_hcl_file_path}"

  echo 'Converting HCL to JSON (via hcl2json)'
  hcl2json < "$infrastructure_hcl_file_path" > "$infrastructure_json_file_path"

  echo 'Converting JSON to TypeScript (via Quicktype)'
  node "${PROJECT_ROOT}/node_modules/quicktype/dist/index.js" "${infrastructure_json_file_path}" -o "${types_file_path}"

  echo 'Prepending TypeScript nocheck on file'
  printf '%s\n%s\n' "// @ts-nocheck" "$(cat "$types_file_path")" > "$types_file_path"

  success "Infrastructure types generated"

  # ============================================================
  # Phase 2: Dependency Graph
  # ============================================================
  section "Phase 2: Dependency Graph"

  echo 'Generating dependency graph for permission tracing'
  node --experimental-strip-types "${PROJECT_ROOT}/scripts/generateDependencyGraph.ts"
  success "Dependency graph generated"

  # ============================================================
  # Phase 3: Terraform Resources
  # ============================================================
  section "Phase 3: Terraform Resources"

  echo 'Extracting Terraform resources for type-safe enums'
  node --import tsx "${PROJECT_ROOT}/scripts/extractTerraformResources.ts"

  echo 'Generating TypeScript resource enums'
  node --import tsx "${PROJECT_ROOT}/scripts/generateResourceEnums.ts"
  success "Terraform resource enums generated"

  # ============================================================
  # Phase 4: Permission Extraction
  # ============================================================
  section "Phase 4: Permission Extraction"

  echo 'Extracting database permissions from Lambda handlers (@RequiresDatabase)'
  node --import tsx "${PROJECT_ROOT}/scripts/extractDbPermissions.ts"

  echo 'Extracting entity permissions from query classes (@RequiresTable)'
  node --import tsx "${PROJECT_ROOT}/scripts/extractEntityPermissions.ts"

  echo 'Extracting service permissions from vendor wrappers (@RequiresXxx)'
  node --import tsx "${PROJECT_ROOT}/scripts/extractServicePermissions.ts"

  echo 'Extracting DynamoDB permissions (@RequiresDynamoDB)'
  node --import tsx "${PROJECT_ROOT}/scripts/extractDynamoDBPermissions.ts"

  echo 'Extracting EventBridge event permissions (event-specific functions)'
  node --import tsx "${PROJECT_ROOT}/scripts/extractEventPermissions.ts"

  success "All permissions extracted"

  # ============================================================
  # Phase 5: Permission Generation
  # ============================================================
  section "Phase 5: Permission Generation"

  echo 'Generating DSQL permissions (Terraform)'
  node --import tsx "${PROJECT_ROOT}/scripts/generateDsqlPermissions.ts"

  echo 'Generating service IAM policies (Terraform)'
  node --import tsx "${PROJECT_ROOT}/scripts/generateServiceIamPolicies.ts"

  # Format Terraform files (optional - tofu may not be installed in CI)
  if command -v tofu &> /dev/null; then
    echo 'Formatting generated Terraform files'
    tofu fmt -recursive "${PROJECT_ROOT}/terraform/"
  else
    echo -e "${YELLOW}Skipping Terraform formatting (tofu not installed)${NC}"
  fi

  # Regenerate Terraform documentation (optional - terraform-docs may not be installed in CI)
  if command -v terraform-docs &> /dev/null; then
    echo 'Regenerating Terraform documentation'
    terraform-docs markdown "${PROJECT_ROOT}/terraform/" > "${PROJECT_ROOT}/docs/terraform.md"
  else
    echo -e "${YELLOW}Skipping Terraform docs generation (terraform-docs not installed)${NC}"
  fi

  success "Permission Terraform files generated"

  # ============================================================
  # Phase 6: Secrets Encryption
  # ============================================================
  section "Phase 6: Secrets Encryption"

  local sops_config_path="${PROJECT_ROOT}/.sops.yaml"

  # Check for SOPS config
  if [ ! -f "$sops_config_path" ]; then
    echo -e "${YELLOW}Warning:${NC} SOPS config file does not exist at $sops_config_path"
    echo "Please refer to the README for SOPS configuration instructions"
    echo "Skipping encryption step"
  else
    # Encrypt environment-specific secrets files
    for env in staging prod; do
      local secrets_file_path="${PROJECT_ROOT}/secrets.${env}.yaml"
      local encrypted_secrets_file_path="${PROJECT_ROOT}/secrets.${env}.enc.yaml"

      echo "Checking secrets.${env}.yaml..."

      if [ ! -f "$secrets_file_path" ]; then
        echo "  No secrets.${env}.yaml found - skipping"
        continue
      fi

      if grep -q "^sops:" "$secrets_file_path" 2> /dev/null; then
        # Source file is already encrypted (has sops metadata) - skip
        echo -e "  ${YELLOW}Warning:${NC} secrets.${env}.yaml appears to already be encrypted - skipping"
        continue
      fi

      if [ ! -f "$encrypted_secrets_file_path" ]; then
        # No encrypted file exists yet - encrypt for the first time
        echo "  Encrypting secrets.${env}.yaml for the first time..."
        sops --config "${sops_config_path}" --encrypt --output "${encrypted_secrets_file_path}" "${secrets_file_path}"
      else
        # Compare hashes to avoid unnecessary re-encryption (AES-GCM uses random IVs)
        local source_hash
        local decrypted_content
        local decrypt_exit_code
        source_hash=$(shasum -a 256 "${secrets_file_path}" | cut -d' ' -f1)
        decrypted_content=$(sops --config "${sops_config_path}" --decrypt "${encrypted_secrets_file_path}" 2> /dev/null) || true
        decrypt_exit_code=$?

        if [ $decrypt_exit_code -ne 0 ]; then
          echo "  Cannot decrypt (missing age key?) - skipping"
        else
          local decrypted_hash
          decrypted_hash=$(echo "$decrypted_content" | shasum -a 256 | cut -d' ' -f1)

          if [ "$source_hash" != "$decrypted_hash" ]; then
            echo "  Secrets changed - re-encrypting..."
            sops --config "${sops_config_path}" --encrypt --output "${encrypted_secrets_file_path}" "${secrets_file_path}"
          else
            echo "  Secrets unchanged - skipping"
          fi
        fi
      fi
    done

  fi

  success "Secrets check completed"

  # ============================================================
  # Done
  # ============================================================
  section "Build Dependencies Complete"
  echo "All extraction and generation scripts have run successfully."
  echo "Generated files in build/:"
  ls -la "${PROJECT_ROOT}/build/"*.json 2>/dev/null || echo "  (no JSON files)"
  echo ""
  echo "To validate Terraform, run: cd terraform && tofu validate"
}

main "$@"
