# Integrated PR Creation

Create a pull request with integrated validation, description generation, and issue linking.

## Quick Start

```bash
# Usage: /create-pr
# Or with options: /create-pr --draft
```

## Workflow

### Step 1: Pre-flight Validation

Run full local CI before creating PR:

```bash
pnpm run ci:local:full
```

**CHECKPOINT**: If CI fails, fix issues before proceeding.

### Step 2: Gather Context

```bash
# Get branch info
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")
CURRENT_BRANCH=$(git branch --show-current)

# Check if already pushed
git fetch origin
if git rev-parse --verify origin/$CURRENT_BRANCH >/dev/null 2>&1; then
  echo "Branch already pushed to remote"
else
  echo "Need to push branch first"
fi
```

### Step 3: Extract Linked Issues

```bash
# From branch name (e.g., feat/ENG-123-description)
ISSUE_ID=$(echo "$CURRENT_BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1)

# From commit messages
ISSUES=$(git log $BASE_BRANCH..HEAD --format="%s %b" | grep -oE '(#[0-9]+|[A-Z]+-[0-9]+)' | sort -u | tr '\n' ' ')

echo "Detected issues: $ISSUE_ID $ISSUES"
```

### Step 4: Validate Commit Messages

```bash
# Check for conventional commits
INVALID_COMMITS=$(git log $BASE_BRANCH..HEAD --format="%s" | grep -vE '^(feat|fix|docs|style|refactor|test|chore)(\([^)]+\))?: .+' || true)

if [ -n "$INVALID_COMMITS" ]; then
  echo "WARNING: Non-conventional commits found:"
  echo "$INVALID_COMMITS"
fi

# Check for AI attribution (should not exist)
AI_REFS=$(git log $BASE_BRANCH..HEAD --format="%s %b" | grep -iE '(claude|anthropic|generated with|co-authored-by.*ai)' || true)

if [ -n "$AI_REFS" ]; then
  echo "ERROR: AI attribution found in commits - must be removed"
  exit 1
fi
```

### Step 5: Analyze Impact

Use MCP tools:

```
MCP Tool: diff_semantic
Query: breaking
BaseRef: origin/master
HeadRef: HEAD
```

```
MCP Tool: lambda_impact
File: [changed files]
Query: all
```

### Step 6: Generate PR Description

Invoke the describe-pr logic:

```markdown
## Summary

[Auto-generated from commit analysis]

## Changes

[Categorized by file patterns]

## Impact Analysis

- **Affected Lambdas**: [from lambda_impact]
- **Breaking Changes**: [from diff_semantic]
- **Database Changes**: [detected from entity files]
- **API Changes**: [detected from TypeSpec/handler changes]

## Test Plan

- [x] Unit tests pass (`pnpm test`)
- [x] Type check passes (`pnpm run check-types`)
- [x] Lint passes (`pnpm run lint`)
- [x] Local CI passes (`pnpm run ci:local:full`)

## Related

- Closes [detected issues]
```

### Step 7: Push Branch

```bash
# Push with upstream tracking
git push -u origin $CURRENT_BRANCH
```

### Step 8: Create PR

```bash
# Create PR with generated description
unset GITHUB_TOKEN && gh pr create \
  --title "[type]: [description from commits]" \
  --body "$(cat <<'EOF'
[Generated PR description]
EOF
)"
```

### Step 9: Verify PR Created

```bash
# Get PR URL
unset GITHUB_TOKEN && gh pr view --web
```

---

## Human Checkpoints

1. **CI validation** - Confirm local CI passes before proceeding
2. **Review generated description** - Verify accuracy before creating PR
3. **Validate linked issues** - Confirm auto-detected issues are correct
4. **Address commit warnings** - Fix any non-conventional commits
5. **Final review** - Check PR before submitting for review

---

## Draft PR Option

For work-in-progress:

```bash
unset GITHUB_TOKEN && gh pr create --draft \
  --title "WIP: [description]" \
  --body "[description]"
```

Convert to ready when complete:

```bash
unset GITHUB_TOKEN && gh pr ready
```

---

## Error Handling

### CI Failure

If `ci:local:full` fails:
1. Fix the issues
2. Commit fixes
3. Re-run validation
4. Proceed with PR creation

### Push Rejected

If push is rejected:
```bash
git fetch origin
git rebase origin/$BASE_BRANCH
# Resolve conflicts if any
git push -u origin $CURRENT_BRANCH
```

### PR Creation Failure

If `gh pr create` fails:
```bash
# Check GitHub CLI auth
unset GITHUB_TOKEN && gh auth status

# Retry with verbose output
unset GITHUB_TOKEN && gh pr create --verbose
```

---

## Output Format

```markdown
## PR Creation Complete

**Branch**: feat/ENG-123-description
**PR URL**: https://github.com/owner/repo/pull/456

### Linked Issues
- ENG-123 (from branch name)
- #789 (from commit message)

### Validation Status
- [x] Local CI passed
- [x] Conventional commits verified
- [x] No AI attribution detected
- [x] Impact analysis complete

### Next Steps
1. [ ] Wait for GitHub CI to pass
2. [ ] Request review from team
3. [ ] Address review feedback
4. [ ] Merge when approved
```

---

## Notes

- Always run `ci:local:full` before creating PR
- No AI attribution in PR description or commits
- Use conventional commit format for all commits
- Link issues using "Closes #X" format
- Monitor GitHub CI after PR creation
