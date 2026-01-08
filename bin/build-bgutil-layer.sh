#!/usr/bin/env bash
# build-bgutil-layer.sh
# Builds the bgutil PO token provider Lambda layer
# Usage: pnpm run build:bgutil-layer
#
# This script builds a Lambda-compatible Python layer containing bgutil-ytdlp-pot-provider.
# The layer enables yt-dlp to generate PO (proof-of-origin) tokens, which help bypass
# YouTube's bot detection when combined with cookie authentication.
#
# @see https://github.com/Brainicism/bgutil-ytdlp-pot-provider
# @see https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAYER_DIR="${PROJECT_ROOT}/layers/bgutil"
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
  echo -e "${GREEN}Building bgutil Lambda layer${NC}"
  echo "=============================="
  echo ""

  # Check if Docker is available
  if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not running. Please install Docker."
  fi

  # Check if requirements.txt exists
  if [ ! -f "${LAYER_DIR}/requirements.txt" ]; then
    error "requirements.txt not found at ${LAYER_DIR}/requirements.txt"
  fi

  echo -e "${YELLOW}Step 1: Cleaning previous build${NC}"
  rm -rf "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}/python"
  echo -e "${GREEN}✓${NC} Build directory created"

  echo ""
  echo -e "${YELLOW}Step 2: Installing Python dependencies via Docker${NC}"
  echo "Using AWS Lambda Python 3.12 runtime for compatibility..."

  # Build using AWS Lambda Python runtime for compatibility
  # The --platform flag ensures we get x86_64 binaries to match yt-dlp/ffmpeg layers
  # --entrypoint "" overrides the Lambda handler entrypoint
  docker run --rm \
    --platform linux/amd64 \
    --entrypoint "" \
    -v "${LAYER_DIR}:/var/task:ro" \
    -v "${BUILD_DIR}/python:/output" \
    public.ecr.aws/lambda/python:3.12 \
    /bin/sh -c "pip install -r /var/task/requirements.txt -t /output --no-cache-dir --quiet && chmod -R 755 /output"

  echo -e "${GREEN}✓${NC} Python dependencies installed"

  echo ""
  echo -e "${YELLOW}Step 3: Creating layer zip${NC}"
  cd "${BUILD_DIR}"
  zip -r9q ../bgutil-layer.zip python/
  echo -e "${GREEN}✓${NC} Layer zip created"

  # Get layer size
  local layer_size
  layer_size=$(du -h "${LAYER_DIR}/bgutil-layer.zip" | cut -f1)

  # Verify layer structure
  local file_count
  file_count=$(unzip -l "${LAYER_DIR}/bgutil-layer.zip" | grep -c "\.py$" || true)

  echo ""
  echo -e "${GREEN}Success!${NC} bgutil Lambda layer built"
  echo ""
  echo "Layer details:"
  echo "  Location: ${LAYER_DIR}/bgutil-layer.zip"
  echo "  Size: ${layer_size}"
  echo "  Python files: ${file_count}"
  echo ""
  echo "Next steps:"
  echo "  1. pnpm run build"
  echo "  2. pnpm run deploy"
  echo ""
  echo -e "${YELLOW}Note: The layer is built for x86_64 (amd64) to match yt-dlp/ffmpeg layers${NC}"
}

main "$@"
