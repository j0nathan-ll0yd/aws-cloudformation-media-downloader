#!/usr/bin/env bash
# build-playwright-layer.sh
# Builds the Puppeteer + Chromium Lambda layer
# Usage: pnpm run build:playwright-layer
#
# This script builds a Lambda-compatible layer containing Puppeteer and a headless Chromium binary.
# Used by RefreshYouTubeCookies Lambda to extract fresh YouTube cookies via browser automation.
#
# @see https://github.com/Sparticuz/chromium
# @see https://pptr.dev/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAYER_DIR="${PROJECT_ROOT}/layers/playwright"
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
  echo -e "${GREEN}Building Puppeteer Lambda layer${NC}"
  echo "=================================="
  echo ""

  # Check if Docker is available
  if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not running. Please install Docker."
  fi

  # Check if VERSION file exists
  if [ ! -f "${LAYER_DIR}/VERSION" ]; then
    error "VERSION file not found at ${LAYER_DIR}/VERSION"
  fi

  local puppeteer_version
  puppeteer_version=$(cat "${LAYER_DIR}/VERSION" | tr -d '\n')

  echo -e "${YELLOW}Step 1: Cleaning previous build${NC}"
  rm -rf "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}/nodejs"
  echo -e "${GREEN}✓${NC} Build directory created"

  echo ""
  echo -e "${YELLOW}Step 2: Creating package.json${NC}"
  cat > "${BUILD_DIR}/nodejs/package.json" << EOF
{
  "name": "puppeteer-layer",
  "version": "1.0.0",
  "description": "Lambda layer for Puppeteer + Chromium with stealth plugin",
  "dependencies": {
    "puppeteer-core": "${puppeteer_version}",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "@sparticuz/chromium": "^133.0.0"
  }
}
EOF
  echo -e "${GREEN}✓${NC} package.json created"

  echo ""
  echo -e "${YELLOW}Step 3: Installing Node.js dependencies via Docker${NC}"
  echo "Using AWS Lambda Node.js 20.x runtime for @sparticuz/chromium compatibility..."

  # Build using AWS Lambda Node.js 20 runtime for @sparticuz/chromium compatibility
  # Node.js 20.x includes the NSS libraries that Chromium requires
  # The --platform flag ensures we get x86_64 binaries to match other layers
  docker run --rm \
    --platform linux/amd64 \
    --entrypoint "" \
    -v "${BUILD_DIR}/nodejs:/var/task" \
    -w /var/task \
    public.ecr.aws/lambda/nodejs:20 \
    /bin/sh -c "npm install --omit=dev --no-audit --no-fund && chmod -R 755 node_modules"

  echo -e "${GREEN}✓${NC} Node.js dependencies installed"

  echo ""
  echo -e "${YELLOW}Step 4: Creating layer zip${NC}"
  cd "${BUILD_DIR}"
  zip -r9q ../playwright-layer.zip nodejs/
  echo -e "${GREEN}✓${NC} Layer zip created"

  # Get layer size
  local layer_size
  layer_size=$(du -h "${LAYER_DIR}/playwright-layer.zip" | cut -f1)

  # Get unzipped size estimate
  local unzipped_size
  unzipped_size=$(du -sh "${BUILD_DIR}/nodejs" | cut -f1)

  echo ""
  echo -e "${GREEN}Success!${NC} Puppeteer Lambda layer built"
  echo ""
  echo "Layer details:"
  echo "  Location: ${LAYER_DIR}/playwright-layer.zip"
  echo "  Compressed size: ${layer_size}"
  echo "  Uncompressed size: ${unzipped_size}"
  echo "  Puppeteer version: ${puppeteer_version}"
  echo ""
  echo "Next steps:"
  echo "  1. pnpm run build"
  echo "  2. pnpm run deploy"
  echo ""
  echo -e "${YELLOW}Note: The layer is built for x86_64 (amd64) architecture${NC}"
}

main "$@"
