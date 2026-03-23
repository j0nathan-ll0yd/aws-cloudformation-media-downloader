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
  # generate the documentation
  node "${PROJECT_ROOT}/node_modules/typedoc/bin/typedoc" --options ./typedoc.json
}

main "$@"
