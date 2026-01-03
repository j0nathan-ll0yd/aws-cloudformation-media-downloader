#!/usr/bin/env bash
# Script: document-api.sh
# Purpose: Generate API documentation from TypeSpec definitions
# Usage: pnpm run document-api or ./bin/document-api.sh

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
  echo -e "${BLUE}➜${NC} Generating API Documentation from TypeSpec..."
  echo ""

  # Step 1: Compile TypeSpec to OpenAPI
  echo -e "${BLUE}➜${NC} Compiling TypeSpec to OpenAPI..."
  pnpm exec tsp compile "$PROJECT_ROOT/tsp" --output-dir "$PROJECT_ROOT/docs/api"

  echo ""

  # Step 2: Update OpenAPI spec with title and version from package.json
  echo -e "${BLUE}➜${NC} Updating title and version from package.json..."
  local PACKAGE_NAME
  local PACKAGE_VERSION
  PACKAGE_NAME=$(node -p "require('$PROJECT_ROOT/package.json').name")
  PACKAGE_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
  echo "   Name: $PACKAGE_NAME"
  echo "   Version: $PACKAGE_VERSION"

  # Update the title and version in the generated OpenAPI file
  sed -i.bak "s/title: Offline Media Downloader API/title: $PACKAGE_NAME/" "$PROJECT_ROOT/docs/api/openapi.yaml"
  sed -i.bak "s/version: 0\.0\.0/version: $PACKAGE_VERSION/" "$PROJECT_ROOT/docs/api/openapi.yaml"
  rm -f "$PROJECT_ROOT/docs/api/openapi.yaml.bak"

  echo ""
  echo -e "${GREEN}✓${NC} OpenAPI specification generated successfully!"
  echo ""

  # Step 3: Generate Redoc HTML documentation
  echo -e "${BLUE}➜${NC} Generating Redoc HTML documentation..."
  # Filter npm warnings about pnpm-specific .npmrc settings (redocly internally calls npm)
  pnpm exec redocly build-docs "$PROJECT_ROOT/docs/api/openapi.yaml" -o "$PROJECT_ROOT/docs/api/index.html" --title "$PACKAGE_NAME" 2>&1 | grep -v "^npm warn"

  echo ""
  echo -e "${GREEN}✓${NC} Redoc HTML documentation generated successfully!"
  echo ""
  echo -e "${BLUE}➜${NC} Generated files:"
  echo "   - docs/api/openapi.yaml (OpenAPI specification)"
  echo "   - docs/api/index.html (Redoc HTML documentation)"
  echo ""
  echo -e "${BLUE}➜${NC} API Summary:"

  # Count endpoints
  local ENDPOINTS
  ENDPOINTS=$(grep -c "operationId:" "$PROJECT_ROOT/docs/api/openapi.yaml")
  echo "   - Total Endpoints: $ENDPOINTS"

  # List tags (categories)
  echo "   - Categories:"
  grep "^  - name:" "$PROJECT_ROOT/docs/api/openapi.yaml" | sed 's/^  - name: /     • /'

  # Step 4: Open the HTML file in the default browser (skip in CI)
  if [ -z "${CI:-}" ]; then
    echo ""
    echo -e "${BLUE}➜${NC} Opening documentation in browser..."
    if command -v open &> /dev/null; then
      # macOS
      open "$PROJECT_ROOT/docs/api/index.html" || true
    elif command -v xdg-open &> /dev/null; then
      # Linux
      xdg-open "$PROJECT_ROOT/docs/api/index.html" 2> /dev/null || true
    elif command -v start &> /dev/null; then
      # Windows
      start "$PROJECT_ROOT/docs/api/index.html" || true
    else
      echo -e "   ${BLUE}➜${NC} Could not automatically open browser. Please open docs/api/index.html manually."
    fi
  fi

  echo ""
  echo -e "${GREEN}✓${NC} Documentation generation complete!"
}

main "$@"
