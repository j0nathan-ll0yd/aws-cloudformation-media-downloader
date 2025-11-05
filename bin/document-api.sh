#!/bin/bash

# API Documentation Generator
# This script generates API documentation from TypeSpec definitions

set -e

echo "📝 Generating API Documentation from TypeSpec..."
echo ""

# Compile TypeSpec to OpenAPI
npm run document-api

echo ""
echo "✅ OpenAPI specification generated successfully!"
echo ""

# Generate Redoc HTML documentation
echo "📄 Generating Redoc HTML documentation..."
npx --yes @redocly/cli build-docs docs/api/openapi.yaml -o docs/api/index.html --title "Offline Media Downloader API"

echo ""
echo "✅ Redoc HTML documentation generated successfully!"
echo ""
echo "📄 Generated files:"
echo "   - docs/api/openapi.yaml (OpenAPI specification)"
echo "   - docs/api/index.html (Redoc HTML documentation)"
echo ""
echo "📊 API Summary:"

# Count endpoints
ENDPOINTS=$(grep -c "operationId:" docs/api/openapi.yaml)
echo "   - Total Endpoints: $ENDPOINTS"

# List tags (categories)
echo "   - Categories:"
grep "^  - name:" docs/api/openapi.yaml | sed 's/^  - name: /     • /'

echo ""
echo "🌐 Opening documentation in browser..."

# Open the HTML file in the default browser
if command -v open &> /dev/null; then
    # macOS
    open docs/api/index.html
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open docs/api/index.html
elif command -v start &> /dev/null; then
    # Windows
    start docs/api/index.html
else
    echo "   ℹ️  Could not automatically open browser. Please open docs/api/index.html manually."
fi

echo ""
echo "✨ Documentation generation complete!"
