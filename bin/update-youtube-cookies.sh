#!/usr/bin/env bash

# update-youtube-cookies.sh
# Extracts YouTube cookies from Chrome and prepares them for Lambda layer
# Usage: pnpm run update-cookies

set -e # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SECURE_DIR="${PROJECT_ROOT}/secure/cookies"
LAYER_DIR="${PROJECT_ROOT}/layers/yt-dlp/cookies"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}YouTube Cookie Extraction Script${NC}"
echo "=================================="
echo ""

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null && ! command -v /opt/homebrew/bin/yt-dlp &> /dev/null; then
  echo -e "${RED}Error: yt-dlp is not installed${NC}"
  echo "Install with: brew install yt-dlp"
  exit 1
fi

# Determine yt-dlp path
YTDLP_CMD="yt-dlp"
if command -v /opt/homebrew/bin/yt-dlp &> /dev/null; then
  YTDLP_CMD="/opt/homebrew/bin/yt-dlp"
fi

echo -e "${YELLOW}Step 1: Creating directories${NC}"
mkdir -p "${SECURE_DIR}"
mkdir -p "${LAYER_DIR}"

echo -e "${YELLOW}Step 2: Extracting cookies from Chrome${NC}"
echo "Note: You must be logged into YouTube in Chrome for this to work"

# Extract all cookies to secure directory
"${YTDLP_CMD}" --cookies-from-browser chrome \
  --cookies "${SECURE_DIR}/youtube-cookies.txt" \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  --quiet --no-warnings || {
  echo -e "${RED}Failed to extract cookies. Are you logged into YouTube in Chrome?${NC}"
  exit 1
}

COOKIE_COUNT=$(wc -l < "${SECURE_DIR}/youtube-cookies.txt" | tr -d ' ')
COOKIE_SIZE=$(wc -c < "${SECURE_DIR}/youtube-cookies.txt" | tr -d ' ')
echo -e "${GREEN}✓ Extracted cookies (${COOKIE_COUNT} lines, ${COOKIE_SIZE} bytes)${NC}"

echo -e "${YELLOW}Step 3: Filtering YouTube and Google domains${NC}"
# Preserve Netscape header and filter domain-specific cookies
head -3 "${SECURE_DIR}/youtube-cookies.txt" > "${SECURE_DIR}/youtube-cookies-filtered.txt"
grep -E '(youtube\.com|google\.com|googlevideo\.com|gstatic\.com|yt3\.ggpht\.com)' \
  "${SECURE_DIR}/youtube-cookies.txt" \
  >> "${SECURE_DIR}/youtube-cookies-filtered.txt"

FILTERED_COUNT=$(wc -l < "${SECURE_DIR}/youtube-cookies-filtered.txt" | tr -d ' ')
FILTERED_SIZE=$(wc -c < "${SECURE_DIR}/youtube-cookies-filtered.txt" | tr -d ' ')
echo -e "${GREEN}✓ Filtered to YouTube/Google domains (${FILTERED_COUNT} lines, ${FILTERED_SIZE} bytes)${NC}"

echo -e "${YELLOW}Step 4: Copying to Lambda layer${NC}"
cp "${SECURE_DIR}/youtube-cookies-filtered.txt" "${LAYER_DIR}/youtube-cookies.txt"
echo -e "${GREEN}✓ Updated Lambda layer cookies${NC}"

echo ""
echo -e "${GREEN}Success!${NC} Cookies are ready for deployment"
echo ""
echo "Next steps:"
echo "  1. pnpm run build"
echo "  2. pnpm run deploy"
echo ""
echo -e "${YELLOW}Note: Cookies should be refreshed periodically (every 30-60 days)${NC}"
