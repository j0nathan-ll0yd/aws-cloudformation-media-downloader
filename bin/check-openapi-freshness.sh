#!/usr/bin/env bash
# Fail when the committed OpenAPI spec differs from what the generator emits now.
#
# Usage: bin/check-openapi-freshness.sh
#
# The check deletes docs/api/openapi.yaml, regenerates it with
# `pnpm run generate:openapi:spec`, and compares the result with the git index. The delete
# comes first because `mantle generate openapi` exits 0 WITHOUT writing when it discovers
# no API handlers, so regenerating over the committed file would pass on a broken
# discovery. With the file gone, a run that writes nothing shows as a deletion and fails.
# On a stale spec the regenerated file stays in the working tree; that is the file to commit.
#
# Exit codes:
#   0      docs/api/openapi.yaml equals the generator output
#   1      the spec is stale, untracked, or the generator wrote nothing
#   other  the generator failed

set -euo pipefail

readonly SPEC='docs/api/openapi.yaml'

cd "$(git rev-parse --show-toplevel)"

# An untracked spec never shows in `git diff`, so the comparison below would pass vacuously.
if ! git ls-files --error-unmatch -- "$SPEC" > /dev/null 2>&1; then
  echo "::error file=${SPEC}::${SPEC} is not tracked by git, so its freshness cannot be measured."
  exit 1
fi

rm -f "$SPEC"
pnpm run generate:openapi:spec

if ! git diff --exit-code -- "$SPEC"; then
  echo "::error file=${SPEC}::${SPEC} differs from the generator output, or the generator wrote nothing. Run 'pnpm run generate:openapi' and commit docs/api/. After merge, the API Contract Sync workflow keeps one tracking issue open in this repository until ios-OfflineMediaDownloader syncs the spec."
  exit 1
fi
echo "${SPEC} equals the output of 'pnpm run generate:openapi:spec'."
