#!/usr/bin/env bash
# build-quickjs-layer.sh
# Downloads pre-built QuickJS binary for the Lambda layer
# Usage: ./bin/build-quickjs-layer.sh
#
# Downloads a statically-linked (musl) QuickJS binary from
# ctn-malone/quickjs-cross-compiler GitHub releases. No Docker needed.
#
# QuickJS replaces Deno (~2MB vs 145MB) as the JS runtime for yt-dlp's
# YouTube challenge solver, freeing layer space for ffmpeg.
#
# @see https://bellard.org/quickjs/
# @see https://github.com/ctn-malone/quickjs-cross-compiler

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAYER_DIR="${PROJECT_ROOT}/layers/quickjs"
VERSION_FILE="${LAYER_DIR}/VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() {
  echo -e "${RED}Error: $1${NC}" >&2
  exit "${2:-1}"
}

main() {
  if [ ! -f "$VERSION_FILE" ]; then
    error "VERSION file not found at ${VERSION_FILE}"
  fi

  local VERSION
  VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
  echo -e "${GREEN}QuickJS Layer Builder${NC}"
  echo "====================="
  echo ""
  echo "Version: ${VERSION}"

  mkdir -p "${LAYER_DIR}/bin"

  # Download pre-built statically-linked binary from ctn-malone/quickjs-cross-compiler
  # These are upstream Bellard QuickJS compiled with musl (fully portable, no glibc dependency)
  local RELEASE_TAG="v${VERSION}_3+ext-lib-0.17.3"
  local DOWNLOAD_URL="https://github.com/ctn-malone/quickjs-cross-compiler/releases/download/${RELEASE_TAG}/quickjs.ext.${VERSION}_3.ext-lib-0.17.3.x86_64.tar.xz"

  echo ""
  echo -e "${YELLOW}Downloading QuickJS ${VERSION} (statically linked, x86_64)...${NC}"

  local TEMP_DIR
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "${TEMP_DIR:-}"' EXIT

  if ! curl -fsSL "${DOWNLOAD_URL}" -o "${TEMP_DIR}/quickjs.tar.xz"; then
    # Fallback: try official Bellard binary (may be glibc-linked)
    echo -e "${YELLOW}Cross-compiler release not found, trying official bellard.org binary...${NC}"
    local BELLARD_URL="https://bellard.org/quickjs/binary_releases/quickjs-linux-x86_64-${VERSION}.zip"
    curl -fsSL "${BELLARD_URL}" -o "${TEMP_DIR}/quickjs.zip" \
      || error "Failed to download QuickJS from both sources"
    cd "${TEMP_DIR}" && unzip -q quickjs.zip
    cp "${TEMP_DIR}/qjs" "${LAYER_DIR}/bin/qjs"
  else
    tar -xf "${TEMP_DIR}/quickjs.tar.xz" -C "${TEMP_DIR}"
    # Find the qjs binary in the extracted archive
    local QJS_BIN
    QJS_BIN=$(find "${TEMP_DIR}" -name "qjs" -type f | head -1)
    if [ -z "$QJS_BIN" ]; then
      error "qjs binary not found in downloaded archive"
    fi
    cp "$QJS_BIN" "${LAYER_DIR}/bin/qjs"
  fi

  chmod +x "${LAYER_DIR}/bin/qjs"
  echo -e "${GREEN}Done${NC}"

  # Verify binary
  local FILE_TYPE
  FILE_TYPE=$(file "${LAYER_DIR}/bin/qjs")
  if [[ "$FILE_TYPE" != *"ELF 64-bit"* ]] || [[ "$FILE_TYPE" != *"x86-64"* ]]; then
    error "Downloaded binary is not Linux x86_64: ${FILE_TYPE}"
  fi

  local BINARY_SIZE
  BINARY_SIZE=$(du -sh "${LAYER_DIR}/bin/qjs" | awk '{print $1}')

  echo ""
  echo -e "${GREEN}QuickJS ${VERSION} ready${NC}"
  echo ""
  echo "  Binary: ${LAYER_DIR}/bin/qjs"
  echo "  Size:   ${BINARY_SIZE}"
  echo "  Type:   ${FILE_TYPE}"
  echo ""
  echo "Next: npx mantle build && npx mantle deploy --stage staging"
}

main "$@"
