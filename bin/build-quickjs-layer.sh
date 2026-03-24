#!/usr/bin/env bash
# build-quickjs-layer.sh
# Builds the QuickJS runtime Lambda layer (replaces Deno — 2MB vs 138MB)
# Usage: ./bin/build-quickjs-layer.sh
#
# QuickJS is a lightweight JavaScript runtime that yt-dlp uses to solve
# YouTube's JavaScript challenges. It replaces Deno, freeing ~136MB of
# layer space for ffmpeg (which previously had to be downloaded from S3
# at cold start).
#
# Requires: Docker (cross-compiles using Amazon Linux 2023 to match Lambda)
#
# @see https://bellard.org/quickjs/
# @see https://github.com/yt-dlp/yt-dlp/wiki/EJS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAYER_DIR="${PROJECT_ROOT}/layers/quickjs"
VERSION="2025-04-26"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() {
  echo -e "${RED}Error: $1${NC}" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${GREEN}Building QuickJS ${VERSION} for Linux x86_64${NC}"
  echo "============================================="
  echo ""

  # Check Docker is available
  if ! command -v docker &>/dev/null; then
    error "Docker is required to cross-compile QuickJS for Linux x86_64"
  fi

  if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running"
  fi

  echo -e "${YELLOW}Step 1: Preparing build directory${NC}"
  mkdir -p "${LAYER_DIR}/bin"
  echo -e "${GREEN}Done${NC}"

  echo ""
  echo -e "${YELLOW}Step 2: Downloading QuickJS ${VERSION} source${NC}"
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "${TEMP_DIR}"' EXIT

  curl -fsSL "https://bellard.org/quickjs/quickjs-${VERSION}.tar.xz" -o "${TEMP_DIR}/quickjs.tar.xz" \
    || error "Failed to download QuickJS source"
  tar -xf "${TEMP_DIR}/quickjs.tar.xz" -C "${TEMP_DIR}"
  echo -e "${GREEN}Done${NC}"

  echo ""
  echo -e "${YELLOW}Step 3: Cross-compiling with Amazon Linux 2023 (matches Lambda runtime)${NC}"
  docker run --rm \
    -v "${TEMP_DIR}/quickjs-${VERSION}:/build" \
    amazonlinux:2023 \
    bash -c "yum install -y gcc make && cd /build && make LDFLAGS=-static qjs" \
    || error "Docker build failed"
  echo -e "${GREEN}Done${NC}"

  echo ""
  echo -e "${YELLOW}Step 4: Installing binary${NC}"
  cp "${TEMP_DIR}/quickjs-${VERSION}/qjs" "${LAYER_DIR}/bin/qjs"
  chmod +x "${LAYER_DIR}/bin/qjs"
  echo "${VERSION}" > "${LAYER_DIR}/VERSION"
  echo -e "${GREEN}Done${NC}"

  # Verify it's a Linux x86_64 binary
  local file_type
  file_type=$(file "${LAYER_DIR}/bin/qjs")
  if [[ "$file_type" != *"ELF 64-bit"* ]] || [[ "$file_type" != *"x86-64"* ]]; then
    error "Built binary is not Linux x86_64: ${file_type}"
  fi

  local binary_size
  binary_size=$(du -sh "${LAYER_DIR}/bin/qjs" | awk '{print $1}')

  echo ""
  echo -e "${GREEN}QuickJS ${VERSION} built successfully${NC}"
  echo ""
  echo "Layer details:"
  echo "  Binary: ${LAYER_DIR}/bin/qjs"
  echo "  Size: ${binary_size}"
  echo "  Type: ${file_type}"
  echo ""
  echo "Next steps:"
  echo "  1. npx mantle generate infra"
  echo "  2. npx mantle build"
  echo "  3. npx mantle deploy --stage staging"
}

main "$@"
