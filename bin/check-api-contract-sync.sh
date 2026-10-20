#!/usr/bin/env bash
# Compare the iOS app's vendored API contract with this backend's committed OpenAPI spec,
# and keep exactly one tracking issue in step with the result.
#
# Usage: bin/check-api-contract-sync.sh <backend-spec> <vendored-spec>
#
# A dry run from a checkout, with ios-OfflineMediaDownloader cloned beside this repository:
#   DRY_RUN=true ISSUE_REPO=j0nathan-ll0yd/mantle-OfflineMediaDownloader \
#     BACKEND_LABEL="local @ $(git rev-parse --short=12 HEAD)" \
#     VENDORED_LABEL="local @ $(git -C ../ios-OfflineMediaDownloader rev-parse --short=12 HEAD)" \
#     bin/check-api-contract-sync.sh docs/api/openapi.yaml \
#     ../ios-OfflineMediaDownloader/APITypes/Sources/APITypes/openapi.yaml
#
# Environment:
#   ISSUE_REPO      owner/repo that holds the tracking issue (default: GITHUB_REPOSITORY)
#   MANAGED_AUTHOR  login that opens the tracking issue, as `gh issue list --json author`
#                   reports it (default: app/github-actions, the GITHUB_TOKEN identity). Set it
#                   with ISSUE_REPO when a personal token writes the issue in another repository.
#   BACKEND_LABEL   backend revision label, for example "main @ 1a2b3c4d5e6f" (required)
#   VENDORED_LABEL  vendored revision label, for example "main @ 5e6f7a8b9c0d" (required)
#   MANAGED_BY      workflow named in the issue body (optional)
#   RUN_URL         link to the workflow run (optional)
#   DRY_RUN         "true" prints every decision and changes nothing; "false" (the default
#                   when unset) acts. Any other value, "1" and empty included, exits 3 before
#                   any GitHub call, so a typo cannot turn a dry run into writes. For a dry
#                   run, set DRY_RUN=true.
#
# Exit codes:
#   0  measured: the files match, or the drift is recorded in the tracking issue
#   3  UNMEASURED: bad input or a failed GitHub call; never a pass. A listing that reaches
#      ISSUE_LIMIT is unmeasured too; narrow the listing before the repository gets there.
#
# Dedupe rule: a managed issue is one that MANAGED_AUTHOR opened and whose body carries
# MARKER. The author check matters because anyone can open an issue in a public repository
# and paste the marker. The lowest-numbered managed issue, in any state, is the tracking
# issue. On drift its title and body are replaced and it is reopened if closed. On sync it is
# closed. A new issue is created only when no managed issue exists. Any other OPEN managed
# issue is closed as a duplicate of the tracking issue.

set -euo pipefail

readonly MARKER='<!-- api-contract-sync:managed -->'
readonly TITLE='API contract drift: iOS APITypes openapi.yaml differs from the backend spec'
# A listing that reaches this many issues may omit the tracking issue, so it is unmeasured.
readonly ISSUE_LIMIT=1000
# GitHub caps an issue body at 65,536 characters; a byte budget stays under it for any text.
readonly MAX_DIFF_BYTES=50000
readonly BACKEND_FILE="mantle-OfflineMediaDownloader \`docs/api/openapi.yaml\`"
readonly VENDORED_FILE="ios-OfflineMediaDownloader \`APITypes/Sources/APITypes/openapi.yaml\`"

unmeasured() {
  echo "::error::UNMEASURED: $*"
  exit 3
}

sha256_of() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Run a mutating gh call, or print it in a dry run. Stdin is /dev/null so that a call made
# inside the duplicate loop below cannot consume the loop's input.
mutate() {
  if [ "$DRY_RUN_MODE" = "true" ]; then
    echo "DRY RUN: $*"
    return 0
  fi
  "$@" < /dev/null || unmeasured "GitHub call failed: $*"
}

[ $# -eq 2 ] || unmeasured "usage: $0 <backend-spec> <vendored-spec>"
BACKEND_SPEC=$1
VENDORED_SPEC=$2
# Actions does not let a step override GITHUB_REPOSITORY, so the target has its own name.
ISSUE_REPO=${ISSUE_REPO:-${GITHUB_REPOSITORY:-}}
[ -n "$ISSUE_REPO" ] || unmeasured "ISSUE_REPO and GITHUB_REPOSITORY are not set"
[ -n "${BACKEND_LABEL:-}" ] || unmeasured "BACKEND_LABEL is not set"
[ -n "${VENDORED_LABEL:-}" ] || unmeasured "VENDORED_LABEL is not set"
MANAGED_AUTHOR=${MANAGED_AUTHOR:-app/github-actions}
# ${DRY_RUN-false}, not ${DRY_RUN:-false}: an empty value is refused below, not read as false.
DRY_RUN_MODE=${DRY_RUN-false}
case "$DRY_RUN_MODE" in
  true | false) ;;
  *) unmeasured "DRY_RUN must be \"true\" or \"false\", not \"${DRY_RUN_MODE}\". For a dry run, set DRY_RUN=true." ;;
esac
MANAGED_BY_TEXT=${MANAGED_BY:-the API contract sync workflow}

for spec in "$BACKEND_SPEC" "$VENDORED_SPEC"; do
  [ -s "$spec" ] || unmeasured "$spec is missing or empty"
  grep -q '^openapi: ' "$spec" || unmeasured "$spec is not an OpenAPI document"
done

BACKEND_SHA256=$(sha256_of "$BACKEND_SPEC")
VENDORED_SHA256=$(sha256_of "$VENDORED_SPEC")

ISSUES_JSON=$(gh issue list --repo "$ISSUE_REPO" --state all --limit "$ISSUE_LIMIT" \
  --json number,state,author,body < /dev/null) || unmeasured "cannot list issues in $ISSUE_REPO"
ISSUE_COUNT=$(jq -e 'if type == "array" then length else error("not an array") end' \
  <<< "$ISSUES_JSON") || unmeasured "cannot parse the issue list"
if [ "$ISSUE_COUNT" -ge "$ISSUE_LIMIT" ]; then
  unmeasured "the issue list reached its ${ISSUE_LIMIT}-issue limit, so the tracking issue may lie outside it"
fi
MANAGED=$(jq -r --arg marker "$MARKER" --arg author "$MANAGED_AUTHOR" \
  '[.[] | select(.author.login == $author and ((.body // "") | contains($marker)))]
    | sort_by(.number) | .[] | "\(.number) \(.state)"' \
  <<< "$ISSUES_JSON") || unmeasured "cannot parse the issue list"

TRACKING=""
TRACKING_STATE=""
while read -r number state; do
  [ -n "$number" ] || continue
  if [ -z "$TRACKING" ]; then
    TRACKING=$number
    TRACKING_STATE=$state
  elif [ "$state" = "OPEN" ]; then
    mutate gh issue close "$number" --repo "$ISSUE_REPO" \
      --comment "Duplicate of #${TRACKING}, the managed API contract drift issue."
  fi
done <<< "$MANAGED"

if [ "$BACKEND_SHA256" = "$VENDORED_SHA256" ]; then
  echo "In sync: backend ${BACKEND_LABEL} and vendored ${VENDORED_LABEL} share sha256 ${BACKEND_SHA256}."
  if [ -n "$TRACKING" ] && [ "$TRACKING_STATE" = "OPEN" ]; then
    mutate gh issue close "$TRACKING" --repo "$ISSUE_REPO" \
      --comment "In sync: ${BACKEND_FILE} (${BACKEND_LABEL}) and ${VENDORED_FILE} (${VENDORED_LABEL}) share sha256 \`${BACKEND_SHA256}\`. Closing automatically. ${RUN_URL:-}"
  fi
  exit 0
fi

DIFF_FILE=$(mktemp)
BODY_FILE=$(mktemp)
trap 'rm -f "$DIFF_FILE" "$BODY_FILE"' EXIT

set +e
diff -u -L "vendored ${VENDORED_LABEL}" -L "backend ${BACKEND_LABEL}" "$VENDORED_SPEC" "$BACKEND_SPEC" > "$DIFF_FILE"
DIFF_STATUS=$?
set -e
[ "$DIFF_STATUS" -eq 1 ] || unmeasured "diff exited ${DIFF_STATUS} on files whose hashes differ"

# Lines 1-2 of a single-pair unified diff are the ---/+++ headers.
ADDED=$(awk 'NR > 2 && /^\+/ { n++ } END { print n + 0 }' "$DIFF_FILE")
REMOVED=$(awk 'NR > 2 && /^-/ { n++ } END { print n + 0 }' "$DIFF_FILE")
DIFF_BYTES=$(wc -c < "$DIFF_FILE" | tr -d ' ')

{
  echo "$MARKER"
  echo "The iOS app's vendored API contract no longer matches the backend's committed spec."
  echo
  echo "| File | Revision | sha256 |"
  echo "| --- | --- | --- |"
  echo "| backend: ${BACKEND_FILE} | ${BACKEND_LABEL} | \`${BACKEND_SHA256}\` |"
  echo "| vendored: ${VENDORED_FILE} | ${VENDORED_LABEL} | \`${VENDORED_SHA256}\` |"
  echo
  echo "Diff from vendored to backend: ${ADDED} lines added, ${REMOVED} lines removed."
  echo
  echo "To sync:"
  echo
  echo "1. Pull \`main\` in sibling checkouts of \`mantle-OfflineMediaDownloader\` and \`ios-OfflineMediaDownloader\`. Do not regenerate \`docs/api/openapi.yaml\`: the backend CI job \"OpenAPI Freshness\" keeps the committed file equal to the generator output, and the sync copies that committed file."
  echo "2. In \`ios-OfflineMediaDownloader\`, run \`bash Scripts/sync-openapi.sh\`, then \`xcrun swift build --package-path APITypes --disable-sandbox\` (the command of the required \"APITypes Build (SPM)\" check)."
  echo "3. Fix any call site the regenerated types break, then open a pull request in \`ios-OfflineMediaDownloader\`."
  echo
  echo "<details><summary>Unified diff (vendored to backend)</summary>"
  echo
  echo '````diff'
  if [ "$DIFF_BYTES" -gt "$MAX_DIFF_BYTES" ]; then
    # Drop the last, possibly partial, line so the cut never splits a line or a character.
    head -c "$MAX_DIFF_BYTES" "$DIFF_FILE" | sed '$d'
    echo "[diff truncated to its first ${MAX_DIFF_BYTES} bytes of ${DIFF_BYTES}, at a line end]"
  else
    cat "$DIFF_FILE"
  fi
  echo '````'
  echo
  echo "</details>"
  echo
  echo "Managed by ${MANAGED_BY_TEXT}. Each run replaces this body, reopens the issue on drift and closes it when the files match. Keep the marker comment on the first line."
  echo
  echo "Last checked: $(date -u +%Y-%m-%dT%H:%M:%SZ) ${RUN_URL:-}"
} > "$BODY_FILE"

if [ -z "$TRACKING" ]; then
  mutate gh issue create --repo "$ISSUE_REPO" --title "$TITLE" --body-file "$BODY_FILE"
else
  # Edit before reopening, so the reopen notification lands on the current body.
  mutate gh issue edit "$TRACKING" --repo "$ISSUE_REPO" --title "$TITLE" --body-file "$BODY_FILE"
  if [ "$TRACKING_STATE" != "OPEN" ]; then
    mutate gh issue reopen "$TRACKING" --repo "$ISSUE_REPO"
  fi
fi

if [ "$DRY_RUN_MODE" = "true" ]; then
  echo "DRY RUN: issue body follows."
  cat "$BODY_FILE"
fi
echo "::warning::API contract drift: vendored ${VENDORED_LABEL} differs from backend ${BACKEND_LABEL} (+${ADDED}/-${REMOVED} lines)."
exit 0
