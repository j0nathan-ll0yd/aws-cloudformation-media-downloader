#!/bin/bash

# Sync Examples Script
# This script syncs test fixtures to TypeSpec examples directory
# ensuring documentation stays in sync with actual test data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLES_DIR="$PROJECT_DIR/tsp/examples"

echo "🔄 Syncing test fixtures to TypeSpec examples..."
echo ""

# Create examples directory if it doesn't exist
mkdir -p "$EXAMPLES_DIR"

# Find all apiRequest and apiResponse fixtures in lambda test directories
echo "📝 Scanning for API fixtures..."

# Track files synced
FILES_SYNCED=0

# Find all apiRequest-* and apiResponse-* files
for fixture_file in $(find "$PROJECT_DIR/src/lambdas" -type f -name "apiRequest-*.json" -o -name "apiResponse-*.json" | sort); do
    # Extract just the filename
    filename=$(basename "$fixture_file")
    
    # Extract lambda name from path
    lambda_name=$(echo "$fixture_file" | sed 's|.*/lambdas/\([^/]*\)/.*|\1|')
    
    # Create a descriptive name for the example file
    # Convert from apiRequest-POST-device.json to something like register-device-request.json
    if [[ "$filename" =~ ^apiRequest-(.*)\.json$ ]]; then
        # This is a request
        method_and_type="${BASH_REMATCH[1]}"
        # Convert lambda name to kebab-case and add -request suffix
        example_name=$(echo "$lambda_name" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
        example_file="$EXAMPLES_DIR/${example_name}-request.json"
    elif [[ "$filename" =~ ^apiResponse-(.*)\.json$ ]]; then
        # This is a response
        method_and_status="${BASH_REMATCH[1]}"
        # Convert lambda name to kebab-case and add -response suffix
        example_name=$(echo "$lambda_name" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//')
        example_file="$EXAMPLES_DIR/${example_name}-response.json"
    else
        continue
    fi
    
    # Copy the fixture to examples directory
    echo "   Syncing: $lambda_name -> $(basename "$example_file")"
    cp "$fixture_file" "$example_file"
    FILES_SYNCED=$((FILES_SYNCED + 1))
done

echo ""
echo "✅ Examples synced successfully!"
echo ""
echo "📍 Examples location: $EXAMPLES_DIR"
echo "📊 Files synced: $FILES_SYNCED"
ls -lh "$EXAMPLES_DIR" | tail -n +2 | awk '{print "   -", $9, "("$5")"}'
