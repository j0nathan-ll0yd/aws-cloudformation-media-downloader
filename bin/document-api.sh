#!/bin/bash

# API Documentation Generator
# This script generates API documentation from TypeSpec definitions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📝 Generating API Documentation from TypeSpec..."
echo ""

# Step 1: Sync examples from test fixtures
echo "🔄 Syncing test fixtures to TypeSpec examples..."
"$SCRIPT_DIR/sync-examples.sh"

echo ""

# Step 2: Compile TypeSpec to OpenAPI
echo "🔨 Compiling TypeSpec to OpenAPI..."
pnpm exec tsp compile "$PROJECT_DIR/tsp" --output-dir "$PROJECT_DIR/docs/api"

echo ""

# Step 3: Update OpenAPI spec with title and version from package.json
echo "📦 Updating title and version from package.json..."
PACKAGE_NAME=$(node -p "require('$PROJECT_DIR/package.json').name")
PACKAGE_VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
echo "   Name: $PACKAGE_NAME"
echo "   Version: $PACKAGE_VERSION"

# Update the title and version in the generated OpenAPI file
sed -i.bak "s/title: Offline Media Downloader API/title: $PACKAGE_NAME/" "$PROJECT_DIR/docs/api/openapi.yaml"
sed -i.bak "s/version: 0\.0\.0/version: $PACKAGE_VERSION/" "$PROJECT_DIR/docs/api/openapi.yaml"
rm -f "$PROJECT_DIR/docs/api/openapi.yaml.bak"

echo ""
echo "✅ OpenAPI specification generated successfully!"
echo ""

# Step 4: Generate Redoc HTML documentation
echo "📄 Generating Redoc HTML documentation..."
# Filter npm warnings about pnpm-specific .npmrc settings (redocly internally calls npm)
pnpm exec redocly build-docs "$PROJECT_DIR/docs/api/openapi.yaml" -o "$PROJECT_DIR/docs/api/index.html" --title "$PACKAGE_NAME" 2>&1 | grep -v "^npm warn"

echo ""
echo "✅ Redoc HTML documentation generated successfully!"
echo ""
echo "📄 Generated files:"
echo "   - docs/api/openapi.yaml (OpenAPI specification)"
echo "   - docs/api/index.html (Redoc HTML documentation)"
echo ""
echo "📊 API Summary:"

# Count endpoints
ENDPOINTS=$(grep -c "operationId:" "$PROJECT_DIR/docs/api/openapi.yaml")
echo "   - Total Endpoints: $ENDPOINTS"

# List tags (categories)
echo "   - Categories:"
grep "^  - name:" "$PROJECT_DIR/docs/api/openapi.yaml" | sed 's/^  - name: /     • /'

# Step 5: Open the HTML file in the default browser (skip in CI)
if [ -z "$CI" ]; then
  echo ""
  echo "🌐 Opening documentation in browser..."
  if command -v open &> /dev/null; then
    # macOS
    open "$PROJECT_DIR/docs/api/index.html" || true
  elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$PROJECT_DIR/docs/api/index.html" 2>/dev/null || true
  elif command -v start &> /dev/null; then
    # Windows
    start "$PROJECT_DIR/docs/api/index.html" || true
  else
    echo "   ℹ️  Could not automatically open browser. Please open docs/api/index.html manually."
  fi
fi

echo ""
echo "✨ Documentation generation complete!"
