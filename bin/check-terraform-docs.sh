#!/usr/bin/env bash
# Fail when docs/terraform.md differs from what the pinned terraform-docs emits for infra/ now.
#
# Usage: bin/check-terraform-docs.sh
#
# Needs terraform-docs at the version bin/install-terraform-docs.sh pins, first on PATH. CI installs
# it with that script; locally, run `bin/install-terraform-docs.sh <dir>` and put <dir> first on
# PATH. Another version emits different output, so the check refuses it rather than report drift.
#
# The check deletes docs/terraform.md, regenerates it by running the `document:terraform` package
# script's command, and compares the result with the git index, blob hash against blob hash, so
# local git settings cannot hide a difference. The command runs with sh, not `pnpm run`: pnpm 11
# installs every dependency before a run when node_modules is missing, which needs the GitHub
# Packages login and is not part of this check. The delete comes first so that a command that
# writes nothing fails instead of leaving the committed file to compare equal. On a stale doc the
# regenerated file stays in the working tree; that is the file to commit.
#
# Exit codes:
#   0      docs/terraform.md equals the generator output
#   1      the doc is stale, untracked or empty, the package script is missing, or terraform-docs
#          is missing or the wrong version
#   other  the generator command failed (its exit status)

set -euo pipefail

readonly DOC='docs/terraform.md'

cd "$(git rev-parse --show-toplevel)"

pinned=$(bin/install-terraform-docs.sh --version)
if ! command -v terraform-docs > /dev/null 2>&1; then
  echo "::error::terraform-docs is not on PATH. Install ${pinned} with bin/install-terraform-docs.sh <dir>."
  exit 1
fi
# `terraform-docs --version` prints "terraform-docs version v0.24.0 <commit> <os>/<arch>".
found=$(terraform-docs --version | awk '{ print $3 }')
if [ "$found" != "$pinned" ]; then
  echo "::error::terraform-docs on PATH is ${found:-unknown}; ${DOC} is generated with ${pinned}. Install it with bin/install-terraform-docs.sh <dir>."
  exit 1
fi

# An untracked doc has no index blob to compare with, so its freshness cannot be measured.
if ! git ls-files --error-unmatch -- "$DOC" > /dev/null 2>&1; then
  echo "::error file=${DOC}::${DOC} is not tracked by git, so its freshness cannot be measured."
  exit 1
fi

# package.json is the single home of the generator command; `pnpm run document:terraform` runs
# the same string for a developer.
command=$(node -e "process.stdout.write(require('./package.json').scripts?.['document:terraform'] ?? '')")
if [ -z "$command" ]; then
  echo "::error::package.json has no document:terraform script."
  exit 1
fi

COMMITTED=$(mktemp)
trap 'rm -f "$COMMITTED"' EXIT
git cat-file blob ":${DOC}" > "$COMMITTED"

rm -f "$DOC"
status=0
sh -c "$command" || status=$?
if [ "$status" -ne 0 ]; then
  echo "::error::The document:terraform command (${command}) exited ${status}."
  exit "$status"
fi

if [ ! -s "$DOC" ]; then
  diff -u --label "committed ${DOC}" --label "regenerated (empty or missing)" "$COMMITTED" /dev/null || true
  echo "::error file=${DOC}::The document:terraform command left ${DOC} empty or missing."
  exit 1
fi

if [ "$(git hash-object -- "$DOC")" != "$(git rev-parse ":${DOC}")" ]; then
  diff -u --label "committed ${DOC}" --label "regenerated ${DOC}" "$COMMITTED" "$DOC" || true
  echo "::error file=${DOC}::${DOC} differs from the terraform-docs ${pinned} output for infra/. Run 'pnpm run document:terraform' with that version and commit ${DOC}."
  exit 1
fi
echo "${DOC} equals the terraform-docs ${pinned} output for infra/."
