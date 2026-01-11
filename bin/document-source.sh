#!/usr/bin/env bash
# Script: document-source.sh
# Purpose: Generate TSDoc documentation for TypeScript source files
# Usage: pnpm run document-source or ./bin/document-source.sh
#
# Note: Workarounds in place because TSDoc's exclude method doesn't work as expected

set -euo pipefail

# Color definitions
RED='\033[0;31m'
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
  local test_file_path="${PROJECT_ROOT}/src/pipeline/infrastructure.environment.test.ts"
  local types_file_path="${PROJECT_ROOT}/src/types/infrastructure.d.ts"
  local git_diff_output
  git_diff_output=$(git diff "${test_file_path}")
  local git_diff_output_length=${#git_diff_output}

  if [[ $git_diff_output_length -gt 0 ]]; then
    error "Test file has changed; commit changes before running"
  fi

  # remove the generated definitions and the file(s) they rely on
  if test -f "$types_file_path"; then
    rm "${PROJECT_ROOT}/src/types/infrastructure.d.ts"
  fi
  rm "${test_file_path}"

  # generate the documentation
  node "${PROJECT_ROOT}/node_modules/typedoc/bin/typedoc" --options ./typedoc.json

  # retrieve or rebuild the files
  git checkout "${test_file_path}"
  pnpm run build:dependencies
}

main "$@"
