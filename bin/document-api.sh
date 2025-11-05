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
npx tsp compile "$PROJECT_DIR/tsp" --output-dir "$PROJECT_DIR/docs/api"

echo ""
echo "✅ OpenAPI specification generated successfully!"
echo ""

# Step 3: Generate Redoc HTML documentation
echo "📄 Generating Redoc HTML documentation..."
npx --yes @redocly/cli build-docs "$PROJECT_DIR/docs/api/openapi.yaml" -o "$PROJECT_DIR/docs/api/index.html" --title "Offline Media Downloader API"

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

echo ""
echo "🌐 Opening documentation in browser..."

# Step 4: Open the HTML file in the default browser
if command -v open &> /dev/null; then
    # macOS
    open "$PROJECT_DIR/docs/api/index.html"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$PROJECT_DIR/docs/api/index.html"
elif command -v start &> /dev/null; then
    # Windows
    start "$PROJECT_DIR/docs/api/index.html"
else
    echo "   ℹ️  Could not automatically open browser. Please open docs/api/index.html manually."
fi

echo ""
echo "✨ Documentation generation complete!"
