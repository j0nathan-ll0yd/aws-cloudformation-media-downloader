#!/usr/bin/env bash
# Auto-update GraphRAG knowledge graph when relevant files change
# This should be triggered by CI or as a git hook

set -euo pipefail

echo "🔍 Checking for changes that require GraphRAG update..."

# Files that require GraphRAG re-extraction when changed
TRIGGER_PATHS=(
  "src/lambdas/"
  "src/entities/"
  "src/lib/vendor/"
  "graphrag/metadata.json"
  "tsp/"
)

# Check if any trigger files have changed
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2> /dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "ℹ️  No changes detected (possibly first commit)"
  exit 0
fi

NEEDS_UPDATE=false

for path in "${TRIGGER_PATHS[@]}"; do
  if echo "$CHANGED_FILES" | grep -q "^${path}"; then
    echo "📝 Detected changes in: $path"
    NEEDS_UPDATE=true
    break
  fi
done

if [ "$NEEDS_UPDATE" = true ]; then
  echo "🔄 Updating GraphRAG knowledge graph..."
  pnpm run graphrag:extract

  echo "✅ GraphRAG knowledge graph updated"
  echo "ℹ️  Vector database is now synchronized with source code"
else
  echo "✅ No GraphRAG update needed"
fi
