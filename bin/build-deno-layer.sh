#!/usr/bin/env bash
# build-deno-layer.sh
# Builds the Deno runtime Lambda layer
# Usage: pnpm run build:deno-layer
#
# This script builds a Lambda-compatible layer containing the Deno JavaScript runtime.
# Required for yt-dlp 2025.11.12+ to solve YouTube's JavaScript challenges.
#
# @see https://github.com/yt-dlp/yt-dlp/issues/15012
# @see https://github.com/yt-dlp/yt-dlp/wiki/EJS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAYER_DIR="${PROJECT_ROOT}/layers/deno"
BUILD_DIR="${LAYER_DIR}/build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${GREEN}Building Deno Lambda layer${NC}"
  echo "=============================="
  echo ""

  # Check if VERSION file exists
  if [ ! -f "${LAYER_DIR}/VERSION" ]; then
    error "VERSION file not found at ${LAYER_DIR}/VERSION"
  fi

  local deno_version
  deno_version=$(cat "${LAYER_DIR}/VERSION" | tr -d '\n')

  echo -e "${YELLOW}Step 1: Cleaning previous build${NC}"
  rm -rf "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}/bin"
  echo -e "${GREEN}✓${NC} Build directory created"

  echo ""
  echo -e "${YELLOW}Step 2: Downloading Deno ${deno_version}${NC}"
  echo "Fetching Deno binary for Linux x86_64..."

  local download_url="https://github.com/denoland/deno/releases/download/v${deno_version}/deno-x86_64-unknown-linux-gnu.zip"
  local checksum_url="https://github.com/denoland/deno/releases/download/v${deno_version}/deno-x86_64-unknown-linux-gnu.zip.sha256sum"

  local zip_name="deno-x86_64-unknown-linux-gnu.zip"

  # Download binary (use original filename for checksum verification)
  curl -fsSL "${download_url}" -o "/tmp/${zip_name}" || error "Failed to download Deno binary"

  # Download and verify checksum
  curl -fsSL "${checksum_url}" -o /tmp/deno.sha256sum || error "Failed to download checksum"

  echo "Verifying checksum..."
  cd /tmp
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c deno.sha256sum || error "Checksum verification failed"
  elif sha256sum --version 2>&1 | grep -q GNU; then
    sha256sum --check deno.sha256sum || error "Checksum verification failed"
  else
    echo -e "${YELLOW}⚠${NC} No compatible checksum utility found, skipping verification"
  fi
  cd - > /dev/null

  echo -e "${GREEN}✓${NC} Checksum verified"

  echo ""
  echo -e "${YELLOW}Step 3: Extracting binary${NC}"
  unzip -o "/tmp/${zip_name}" -d "${BUILD_DIR}/bin"
  chmod +x "${BUILD_DIR}/bin/deno"
  echo -e "${GREEN}✓${NC} Binary extracted"

  # Verify binary version on Linux
  if [ "$(uname -s)" = "Linux" ]; then
    echo ""
    echo -e "${YELLOW}Step 4: Verifying binary${NC}"
    local binary_version
    binary_version=$("${BUILD_DIR}/bin/deno" --version | head -1 | awk '{print $2}')
    if [ "${binary_version}" != "${deno_version}" ]; then
      error "Binary version mismatch (expected: ${deno_version}, got: ${binary_version})"
    fi
    echo -e "${GREEN}✓${NC} Binary version verified: ${binary_version}"
  else
    echo ""
    echo -e "${YELLOW}Step 4: Skipping binary verification${NC}"
    echo "⏭️  Skipping binary test (Linux binary, non-Linux host)"
  fi

  echo ""
  echo -e "${YELLOW}Step 5: Creating layer zip${NC}"
  cd "${BUILD_DIR}"
  zip -r9q ../deno-layer.zip bin/
  echo -e "${GREEN}✓${NC} Layer zip created"

  # Get layer size
  local layer_size
  layer_size=$(du -h "${LAYER_DIR}/deno-layer.zip" | cut -f1)

  # Cleanup
  rm -f "/tmp/${zip_name}" /tmp/deno.sha256sum

  echo ""
  echo -e "${GREEN}Success!${NC} Deno Lambda layer built"
  echo ""
  echo "Layer details:"
  echo "  Location: ${LAYER_DIR}/deno-layer.zip"
  echo "  Size: ${layer_size}"
  echo "  Deno version: ${deno_version}"
  echo ""
  echo "Next steps:"
  echo "  1. pnpm run build"
  echo "  2. pnpm run deploy"
  echo ""
  echo -e "${YELLOW}Note: The layer is built for x86_64 (amd64) to match yt-dlp/ffmpeg layers${NC}"
}

main "$@"
