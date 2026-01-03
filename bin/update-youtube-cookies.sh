#!/usr/bin/env bash

# update-youtube-cookies.sh
# Extracts YouTube cookies from Firefox and prepares them for Lambda layer
# Usage: pnpm run update-cookies
#
# Why Firefox instead of Chrome?
# - Chrome aggressively rotates session cookies when you browse YouTube
# - By the time you export, Chrome cookies are often already invalidated
# - Firefox is more stable for cookie extraction
# - See: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies

set -euo pipefail # Exit on error, undefined vars, pipe failures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SECURE_DIR="${PROJECT_ROOT}/secure/cookies"
LAYER_DIR="${PROJECT_ROOT}/layers/yt-dlp/cookies"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Error handler
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

main() {
  echo -e "${GREEN}YouTube Cookie Extraction Script${NC}"
  echo "=================================="
  echo ""

  # Check if yt-dlp is installed
  if ! command -v yt-dlp &> /dev/null && ! command -v /opt/homebrew/bin/yt-dlp &> /dev/null; then
    error "yt-dlp is not installed. Install with: brew install yt-dlp"
  fi

  # Determine yt-dlp path
  local YTDLP_CMD="yt-dlp"
  if command -v /opt/homebrew/bin/yt-dlp &> /dev/null; then
    YTDLP_CMD="/opt/homebrew/bin/yt-dlp"
  fi

  echo -e "${YELLOW}Step 1: Creating directories${NC}"
  mkdir -p "${SECURE_DIR}"
  mkdir -p "${LAYER_DIR}"

  echo -e "${YELLOW}Step 2: Extracting cookies from Firefox${NC}"
  echo "Note: You must be logged into YouTube in Firefox for this to work"
  echo "      Firefox should be closed for best results"

  # Extract all cookies to secure directory
  "${YTDLP_CMD}" --cookies-from-browser firefox \
    --cookies "${SECURE_DIR}/youtube-cookies.txt" \
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
    --quiet --no-warnings || {
    echo -e "${RED}Failed to extract cookies. Are you logged into YouTube in Firefox?${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Open Firefox and log into YouTube"
    echo "  2. Close Firefox completely"
    echo "  3. Run this script again"
    exit 1
  }

  local COOKIE_COUNT
  local COOKIE_SIZE
  COOKIE_COUNT=$(wc -l < "${SECURE_DIR}/youtube-cookies.txt" | tr -d ' ')
  COOKIE_SIZE=$(wc -c < "${SECURE_DIR}/youtube-cookies.txt" | tr -d ' ')
  echo -e "${GREEN}✓${NC} Extracted cookies (${COOKIE_COUNT} lines, ${COOKIE_SIZE} bytes)"

  echo -e "${YELLOW}Step 3: Filtering YouTube and Google domains${NC}"
  # Preserve Netscape header and filter domain-specific cookies
  head -3 "${SECURE_DIR}/youtube-cookies.txt" > "${SECURE_DIR}/youtube-cookies-filtered.txt"
  grep -E '(youtube\.com|google\.com|googlevideo\.com|gstatic\.com|yt3\.ggpht\.com)' \
    "${SECURE_DIR}/youtube-cookies.txt" \
    >> "${SECURE_DIR}/youtube-cookies-filtered.txt"

  local FILTERED_COUNT
  local FILTERED_SIZE
  FILTERED_COUNT=$(wc -l < "${SECURE_DIR}/youtube-cookies-filtered.txt" | tr -d ' ')
  FILTERED_SIZE=$(wc -c < "${SECURE_DIR}/youtube-cookies-filtered.txt" | tr -d ' ')
  echo -e "${GREEN}✓${NC} Filtered to YouTube/Google domains (${FILTERED_COUNT} lines, ${FILTERED_SIZE} bytes)"

  echo -e "${YELLOW}Step 4: Copying to Lambda layer${NC}"
  cp "${SECURE_DIR}/youtube-cookies-filtered.txt" "${LAYER_DIR}/youtube-cookies.txt"
  echo -e "${GREEN}✓${NC} Updated Lambda layer cookies"

  echo ""
  echo -e "${GREEN}Success!${NC} Cookies are ready for deployment"
  echo ""
  echo "Next steps:"
  echo "  1. pnpm run build"
  echo "  2. pnpm run deploy"
  echo ""
  echo -e "${YELLOW}Note: Cookies should be refreshed periodically (every 30-60 days)${NC}"
}

main "$@"
