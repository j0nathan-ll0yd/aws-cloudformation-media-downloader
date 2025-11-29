#!/usr/bin/env bash

# update-yt-dlp.sh
# Checks for latest yt-dlp version and optionally updates VERSION file
# Usage: pnpm run update-yt-dlp [check|update]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION_FILE="${PROJECT_ROOT}/layers/yt-dlp/VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="${1:-check}"

echo -e "${GREEN}yt-dlp Version Manager${NC}"
echo "====================="
echo ""

if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error:${NC} GitHub CLI (gh) is required but not installed"
    echo "Install with: brew install gh"
    exit 1
fi

echo -e "${BLUE}Fetching latest yt-dlp release...${NC}"
LATEST_VERSION=$(gh api repos/yt-dlp/yt-dlp/releases --jq '[.[] | select(.prerelease == false)][0].tag_name')

if [ -z "$LATEST_VERSION" ]; then
    echo -e "${RED}Error:${NC} Failed to fetch latest version from GitHub"
    exit 1
fi

echo -e "${GREEN}Latest version:${NC} ${LATEST_VERSION}"

if [ -f "$VERSION_FILE" ]; then
    CURRENT_VERSION=$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')
    echo -e "${GREEN}Current version:${NC} ${CURRENT_VERSION}"
else
    CURRENT_VERSION="none"
    echo -e "${YELLOW}Warning:${NC} VERSION file not found at ${VERSION_FILE}"
fi

echo ""

if [ "$LATEST_VERSION" == "$CURRENT_VERSION" ]; then
    echo -e "${GREEN}✅ Already on latest version${NC}"
    exit 0
fi

echo -e "${YELLOW}Update available:${NC} ${CURRENT_VERSION} → ${LATEST_VERSION}"
echo ""

if [ "$MODE" == "check" ]; then
    echo "Run with 'update' argument to update VERSION file:"
    echo "  pnpm run update-yt-dlp update"
    exit 0
fi

if [ "$MODE" == "update" ]; then
    echo -e "${BLUE}Updating VERSION file...${NC}"
    mkdir -p "$(dirname "$VERSION_FILE")"
    echo "$LATEST_VERSION" > "$VERSION_FILE"

    echo -e "${GREEN}✅ VERSION file updated${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review the change: git diff ${VERSION_FILE}"
    echo "  2. Run Terraform to download binary: pnpm run plan"
    echo "  3. Commit the change: git add ${VERSION_FILE}"
    echo "     git commit -m \"chore(deps): update yt-dlp to ${LATEST_VERSION}\""
    exit 0
fi

echo -e "${RED}Error:${NC} Unknown mode '${MODE}'"
echo "Usage: $0 [check|update]"
exit 1
