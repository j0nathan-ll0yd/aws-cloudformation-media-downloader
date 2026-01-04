#!/usr/bin/env bash
# Update yt-dlp Lambda layer binary
# Usage: ./scripts/update-ytdlp.sh [--check-only]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="$PROJECT_ROOT/layers/yt-dlp/VERSION"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_only=false
[[ "${1:-}" == "--check-only" ]] && check_only=true

current_version=$(cat "$VERSION_FILE" 2>/dev/null || echo "none")
latest_version=$(curl -sL "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

echo "yt-dlp layer update check"
echo "========================="
echo "Current version: $current_version"
echo "Latest version:  $latest_version"
echo ""

if [[ "$current_version" == "$latest_version" ]]; then
  echo -e "${GREEN}yt-dlp is up to date${NC}"
  exit 0
fi

echo -e "${YELLOW}Update available: $current_version -> $latest_version${NC}"

if $check_only; then
  echo ""
  echo "Run without --check-only to update"
  exit 0
fi

read -p "Update VERSION file? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "$latest_version" > "$VERSION_FILE"
  echo -e "${GREEN}Updated VERSION to $latest_version${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Run 'tofu plan' to preview changes"
  echo "  2. Run 'tofu apply' to download new binary"
  echo "  3. Test and deploy"
fi
