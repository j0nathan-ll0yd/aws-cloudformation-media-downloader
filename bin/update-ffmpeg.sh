#!/usr/bin/env bash
# Update ffmpeg Lambda layer binary
# Usage: ./bin/update-ffmpeg.sh [--check-only]
#
# Note: ffmpeg updates are infrequent. John Van Sickle's builds don't have
# a releases API, so this script helps with manual version management.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="$PROJECT_ROOT/layers/ffmpeg/VERSION"
FFMPEG_URL="https://johnvansickle.com/ffmpeg/"

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

check_only=false
[[ "${1:-}" == "--check-only" ]] && check_only=true

current_version=$(cat "$VERSION_FILE" 2> /dev/null || echo "none")

echo "ffmpeg layer update check"
echo "========================="
echo "Current version: $current_version"
echo ""
echo -e "${CYAN}Note: ffmpeg updates require manual version verification${NC}"
echo "Check latest version at: $FFMPEG_URL"
echo ""

if $check_only; then
  exit 0
fi

read -rp "Enter new version (or press Enter to skip): " new_version
if [[ -n "$new_version" ]]; then
  echo "$new_version" > "$VERSION_FILE"
  echo -e "${GREEN}Updated VERSION to $new_version${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Delete layers/ffmpeg/bin/ffmpeg to force re-download"
  echo "  2. Run 'tofu plan' to preview changes"
  echo "  3. Run 'tofu apply' to download new binary"
  echo "  4. Test and deploy"
else
  echo "Skipped"
fi
