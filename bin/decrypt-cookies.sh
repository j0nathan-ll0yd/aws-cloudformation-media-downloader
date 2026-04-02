#!/usr/bin/env bash
set -euo pipefail

COOKIES_ENC="layers/yt-dlp/cookies/youtube-cookies.enc"
COOKIES_TXT="layers/yt-dlp/cookies/youtube-cookies.txt"

if [[ -f "$COOKIES_TXT" ]]; then
  echo "Cookies already decrypted, skipping"
  exit 0
fi

if [[ ! -f "$COOKIES_ENC" ]]; then
  echo "ERROR: Encrypted cookies file not found: $COOKIES_ENC"
  exit 1
fi

if ! command -v sops &>/dev/null; then
  echo "ERROR: sops is not installed. Install with: brew install sops"
  exit 1
fi

mkdir -p "$(dirname "$COOKIES_TXT")"
sops decrypt --output-type binary "$COOKIES_ENC" > "$COOKIES_TXT"
echo "Decrypted cookies to $COOKIES_TXT"
