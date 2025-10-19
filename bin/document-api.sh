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
echo "📄 Generated files:"
echo "   - docs/api/openapi.yaml"
echo ""
echo "🔍 To view the documentation, you can:"
echo "   1. Upload docs/api/openapi.yaml to https://editor.swagger.io/"
echo "   2. Use a local OpenAPI viewer"
echo "   3. Use Redoc: npx @redocly/cli preview-docs docs/api/openapi.yaml"
echo ""
echo "📊 API Summary:"

# Count endpoints
ENDPOINTS=$(grep -c "operationId:" docs/api/openapi.yaml)
echo "   - Total Endpoints: $ENDPOINTS"

# List tags (categories)
echo "   - Categories:"
grep "^  - name:" docs/api/openapi.yaml | sed 's/^  - name: /     • /'

echo ""
echo "✨ Documentation generation complete!"
