# Cleanup Local Branches

Remove local branches and worktrees that don't have corresponding open PRs on GitHub.

## Quick Start

```bash
# Usage: /cleanup-branches
# Or with options: /cleanup-branches --dry-run
```

## Workflow

### Step 1: Fetch Latest from Remote

```bash
git fetch origin --prune
```

### Step 2: Get Open PRs from GitHub

```bash
# List all open PRs with their head branch names
OPEN_PR_BRANCHES=$(unset GITHUB_TOKEN && gh pr list --state open --json headRefName --jq '.[].headRefName')

echo "Open PR branches:"
echo "$OPEN_PR_BRANCHES"
```

### Step 3: Get Local Branches

```bash
# List all local branches (excluding master and current branch)
CURRENT_BRANCH=$(git branch --show-current)
LOCAL_BRANCHES=$(git branch --format='%(refname:short)' | grep -v '^master$' | grep -v "^${CURRENT_BRANCH}$")

echo "Local branches:"
echo "$LOCAL_BRANCHES"
```

### Step 4: Get Worktrees

```bash
# List all worktrees (excluding main repository)
MAIN_REPO="/Users/jlloyd/Repositories/aws-cloudformation-media-downloader"
git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | grep -v "^${MAIN_REPO}$"
```

### Step 5: Identify Orphaned Branches

For each local branch, check if it has a corresponding open PR:

```bash
ORPHANED_BRANCHES=()

for branch in $LOCAL_BRANCHES; do
  # Skip protected branches
  if [[ "$branch" == "master" || "$branch" == "main" ]]; then
    continue
  fi

  # Check if branch has an open PR
  if ! echo "$OPEN_PR_BRANCHES" | grep -qx "$branch"; then
    ORPHANED_BRANCHES+=("$branch")
    echo "Orphaned: $branch (no open PR)"
  else
    echo "Active: $branch (has open PR)"
  fi
done
```

### Step 6: Identify Orphaned Worktrees

```bash
ORPHANED_WORKTREES=()

# Get worktree paths and their branches
git worktree list | while read worktree_line; do
  WORKTREE_PATH=$(echo "$worktree_line" | awk '{print $1}')
  WORKTREE_BRANCH=$(echo "$worktree_line" | awk '{print $3}' | tr -d '[]')

  # Skip main repository
  if [[ "$WORKTREE_PATH" == "$MAIN_REPO" ]]; then
    continue
  fi

  # Skip if branch has open PR
  if echo "$OPEN_PR_BRANCHES" | grep -qx "$WORKTREE_BRANCH"; then
    echo "Active worktree: $WORKTREE_PATH ($WORKTREE_BRANCH)"
  else
    ORPHANED_WORKTREES+=("$WORKTREE_PATH")
    echo "Orphaned worktree: $WORKTREE_PATH ($WORKTREE_BRANCH)"
  fi
done
```

**CHECKPOINT**: Review the list of orphaned branches and worktrees before deletion.

### Step 7: Remove Orphaned Worktrees

For each orphaned worktree:

```bash
for worktree in "${ORPHANED_WORKTREES[@]}"; do
  echo "Removing worktree: $worktree"

  # Check for uncommitted changes
  if [ -d "$worktree" ]; then
    cd "$worktree"
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      echo "WARNING: Uncommitted changes in $worktree"
      git status --short
      # CHECKPOINT: Confirm deletion with uncommitted changes
    fi
    cd "$MAIN_REPO"
  fi

  # Remove worktree
  git worktree remove "$worktree" --force
done
```

### Step 8: Delete Orphaned Local Branches

```bash
for branch in "${ORPHANED_BRANCHES[@]}"; do
  echo "Deleting branch: $branch"
  git branch -D "$branch"
done
```

### Step 9: Prune Stale References

```bash
# Clean up stale worktree references
git worktree prune

# Prune remote tracking branches
git remote prune origin
```

### Step 10: Verify Cleanup

```bash
echo "=== Remaining Worktrees ==="
git worktree list

echo "=== Remaining Local Branches ==="
git branch

echo "=== Open PRs ==="
unset GITHUB_TOKEN && gh pr list --state open
```

---

## Human Checkpoints

1. **Review orphaned items** - Confirm the list of branches/worktrees to delete is correct
2. **Uncommitted changes warning** - For worktrees with uncommitted changes, confirm deletion
3. **Verify cleanup** - Review remaining branches and worktrees after cleanup

---

## Dry Run Mode

Preview what would be deleted without making changes:

```bash
# /cleanup-branches --dry-run
```

In dry-run mode:
- List all orphaned branches and worktrees
- Show uncommitted changes warnings
- DO NOT delete anything
- Print summary of what would be deleted

---

## Output Format

```markdown
## Branch Cleanup Complete

### Open PRs on GitHub
| PR # | Branch | Title |
|------|--------|-------|
| #123 | feat/new-feature | Add new feature |
| #456 | fix/bug-fix | Fix critical bug |

### Deleted Worktrees
- ~/wt/aws-cloudformation-media-downloader-old-feature (branch: feat/old-feature)
- ~/wt/aws-cloudformation-media-downloader-abandoned (branch: feat/abandoned)

### Deleted Branches
- feat/old-feature
- feat/abandoned
- fix/completed-fix

### Preserved (has open PR)
- feat/new-feature
- fix/bug-fix

### Protected (always preserved)
- master

### Verification
```
$ git worktree list
/Users/jlloyd/Repositories/aws-cloudformation-media-downloader  abc1234 [master]
/Users/jlloyd/wt/aws-cloudformation-media-downloader-new-feature  def5678 [feat/new-feature]

$ git branch
* master
  feat/new-feature
  fix/bug-fix
```

### Summary
- Worktrees removed: 2
- Branches deleted: 3
- Active branches preserved: 2
```

---

## Error Handling

### GitHub CLI Not Authenticated

```bash
if ! unset GITHUB_TOKEN && gh auth status >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI not authenticated"
  echo "Run: gh auth login"
  exit 1
fi
```

### Cannot Remove Worktree

```bash
if ! git worktree remove "$worktree" 2>/dev/null; then
  echo "Cannot remove worktree normally, using force..."
  git worktree remove "$worktree" --force
fi
```

### Branch Deletion Fails

```bash
if ! git branch -D "$branch" 2>/dev/null; then
  echo "WARNING: Could not delete branch $branch"
  echo "It may be checked out in another worktree"
fi
```

---

## Safety Measures

### Protected Branches

The following branches are NEVER deleted:
- `master`
- `main`
- Current branch (branch you're on)

### Worktree Protection

Before deleting a worktree:
1. Check for uncommitted changes
2. Warn user if changes exist
3. Require confirmation for worktrees with changes

### Remote Branch Preservation

This command ONLY deletes:
- Local branches
- Local worktrees

Remote branches are NOT affected. They should be deleted via GitHub PR merge or manually.

---

## Notes

- Run from the main repository directory, not a worktree
- Ensure GitHub CLI is authenticated (`gh auth status`)
- Use `--dry-run` first to preview changes
- Remote branches are preserved (delete via GitHub)
- Master/main branches are always protected
