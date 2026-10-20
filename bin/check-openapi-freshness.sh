#!/usr/bin/env bash
# Fail when the committed OpenAPI spec differs from what the generator emits now.
#
# Usage: bin/check-openapi-freshness.sh
#
# The check deletes docs/api/openapi.yaml, regenerates it with
# `pnpm run generate:openapi:spec`, and compares the result with the git index. The delete
# comes first because `mantle generate openapi` exits 0 WITHOUT writing when it discovers
# no API handlers, so regenerating over the committed file would pass on a broken
# discovery. With the file gone, a run that writes nothing fails.
# The comparison is blob hash against blob hash, so local git settings (assume-unchanged,
# diff drivers, colour) cannot hide a difference. On a stale spec the regenerated file stays
# in the working tree; that is the file to commit.
#
# Exit codes:
#   0      docs/api/openapi.yaml equals the generator output
#   1      the spec is stale, untracked, or the generator wrote nothing
#   other  the generator failed

set -euo pipefail

readonly SPEC='docs/api/openapi.yaml'

cd "$(git rev-parse --show-toplevel)"

# An untracked spec has no index blob to compare with, so its freshness cannot be measured.
if ! git ls-files --error-unmatch -- "$SPEC" > /dev/null 2>&1; then
  echo "::error file=${SPEC}::${SPEC} is not tracked by git, so its freshness cannot be measured."
  exit 1
fi

COMMITTED=$(mktemp)
trap 'rm -f "$COMMITTED"' EXIT
git cat-file blob ":${SPEC}" > "$COMMITTED"

rm -f "$SPEC"
pnpm run generate:openapi:spec

if [ ! -f "$SPEC" ]; then
  diff -u --label "committed ${SPEC}" --label "regenerated (no file)" "$COMMITTED" /dev/null || true
  echo "::error file=${SPEC}::The generator exited 0 but wrote no ${SPEC}, for example because it discovered no API handlers."
  exit 1
fi

if [ "$(git hash-object -- "$SPEC")" != "$(git rev-parse ":${SPEC}")" ]; then
  diff -u --label "committed ${SPEC}" --label "regenerated ${SPEC}" "$COMMITTED" "$SPEC" || true
  echo "::error file=${SPEC}::${SPEC} differs from the generator output. Run 'pnpm run generate:openapi' and commit docs/api/. After merge, the API Contract Sync workflow keeps one tracking issue open in this repository until ios-OfflineMediaDownloader syncs the spec."
  exit 1
fi
echo "${SPEC} equals the output of 'pnpm run generate:openapi:spec'."
