#!/usr/bin/env bash
# Install the pinned terraform-docs release into a directory, after checking its sha256.
#
# Usage: bin/install-terraform-docs.sh <directory>
#        bin/install-terraform-docs.sh --version    (print the pinned version)
#
# docs/terraform.md is the output of this exact version (`pnpm run document:terraform`), and the
# ci.yml job "Terraform Docs Freshness" regenerates it with this exact version, so this file is the
# single home of the pin. To move to a new release: set TERRAFORM_DOCS_VERSION, copy the four
# sha256 values from that release's terraform-docs-<version>.sha256sum after checking them against
# your own downloads, then run `pnpm run document:terraform` with the new binary and commit
# docs/terraform.md in the same pull request.
#
# The archive is a github.com release asset. Fleet jobs reach it: github.com and
# release-assets.githubusercontent.com fall in the GitHub ranges of the Colima egress allowlist,
# as update-ffmpeg.yml's release downloads on the same lane show.
#
# Exit codes: 0 installed; 1 bad usage, unsupported platform, failed download or wrong checksum.

set -euo pipefail

readonly TERRAFORM_DOCS_VERSION='v0.24.0'
readonly BASE_URL="https://github.com/terraform-docs/terraform-docs/releases/download/${TERRAFORM_DOCS_VERSION}"

# sha256 of each release archive, from terraform-docs-v0.24.0.sha256sum; each value was also
# checked against an independent download on 2026-10-20.
pinned_sha256() {
  case "$1" in
    linux-arm64) echo 'd12bd7b73c1fc9c64efc79f8157dd713dabd559f1ecf3cfc0f42e32279a155fd' ;;
    linux-amd64) echo '9005daf969de0b50134493a2c00078b49f5f5b39d021cda7c89bf4d4f3d776d3' ;;
    darwin-arm64) echo 'f6b114f4b032f3f9202ab6c23bfd28c3c8e68aeeb8a8f12fc118bf2073081d71' ;;
    darwin-amd64) echo '3c3f7f18f908457fd1209cbe341418f7f6bae78c08126cfbe8de0d1b06aa8781' ;;
    *) return 1 ;;
  esac
}

sha256_of() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

if [ "${1:-}" = '--version' ]; then
  echo "$TERRAFORM_DOCS_VERSION"
  exit 0
fi
if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: $0 <directory> | --version" >&2
  exit 1
fi
DEST=$1

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) os=unsupported ;;
esac
case "$(uname -m)" in
  aarch64 | arm64) arch=arm64 ;;
  x86_64 | amd64) arch=amd64 ;;
  *) arch=unsupported ;;
esac
platform="${os}-${arch}"
if ! expected=$(pinned_sha256 "$platform"); then
  echo "::error::terraform-docs ${TERRAFORM_DOCS_VERSION} has no pinned checksum for ${platform}."
  exit 1
fi

archive="terraform-docs-${TERRAFORM_DOCS_VERSION}-${platform}.tar.gz"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# A transient failure gets up to 3 retries, each started within 60 s of the first attempt. One
# transfer takes at most 300 s, and the checksum below still gates whatever arrives.
curl -fsSL --connect-timeout 15 --max-time 300 --retry 3 --retry-connrefused --retry-max-time 60 \
  -o "${WORK}/${archive}" "${BASE_URL}/${archive}"
actual=$(sha256_of "${WORK}/${archive}")
if [ "$actual" != "$expected" ]; then
  echo "::error::${archive} has sha256 ${actual}, not the pinned ${expected}. Refusing to install it."
  exit 1
fi

tar -xzf "${WORK}/${archive}" -C "$WORK" terraform-docs
mkdir -p "$DEST"
install -m 0755 "${WORK}/terraform-docs" "${DEST}/terraform-docs"
"${DEST}/terraform-docs" --version
