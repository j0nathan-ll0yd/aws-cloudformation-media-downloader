# Feature Branch Finish

Clean up a feature branch after merge, removing worktree and local branch.

## Quick Start

```bash
# Usage: /feature-finish <feature-name>
# Example: /feature-finish add-user-preferences
# Example: /feature-finish (auto-detects current feature)
```

## Workflow

### Step 1: Identify Feature

If feature name not provided, detect from current directory:

```bash
# Get current worktree
CURRENT_DIR=$(pwd)
WORKTREE_NAME=$(basename "$CURRENT_DIR")

# Extract feature name from worktree directory
FEATURE_NAME=$(echo "$WORKTREE_NAME" | sed 's/aws-cloudformation-media-downloader-//')
BRANCH_NAME="feat/${FEATURE_NAME}"
```

### Step 2: Verify Branch Status

Check if branch is merged:

```bash
# Check if branch is merged to master
git fetch origin
if git branch --merged origin/master | grep -q "$BRANCH_NAME"; then
  echo "Branch $BRANCH_NAME is merged to master"
  MERGED=true
else
  echo "WARNING: Branch $BRANCH_NAME is NOT merged to master"
  MERGED=false
fi
```

**CHECKPOINT**: If not merged, confirm deletion is intentional.

### Step 3: Check for Uncommitted Changes

```bash
WORKTREE_PATH="$HOME/wt/aws-cloudformation-media-downloader-${FEATURE_NAME}"

if [ -d "$WORKTREE_PATH" ]; then
  cd "$WORKTREE_PATH"
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Uncommitted changes in worktree"
    git status --short
    exit 1
  fi
fi
```

### Step 4: Remove Worktree

```bash
# Return to main repository first
cd /Users/jlloyd/Repositories/aws-cloudformation-media-downloader

# Remove the worktree
git worktree remove "$WORKTREE_PATH" --force
```

### Step 5: Delete Local Branch

```bash
# Delete local branch
git branch -D "$BRANCH_NAME" 2>/dev/null || true
```

### Step 6: Clean Remote Branch (Optional)

If branch was pushed but PR is merged:

```bash
# Check if remote branch exists
if git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
  echo "Remote branch exists: origin/$BRANCH_NAME"
  # Usually deleted by GitHub on PR merge, but can force delete:
  # git push origin --delete "$BRANCH_NAME"
fi
```

### Step 7: Update Main Repository

```bash
# Pull latest master
git checkout master
git pull origin master

# Regenerate context files
pnpm run graphrag:extract
pnpm run pack:context
```

### Step 8: Verify Cleanup

```bash
# List remaining worktrees
git worktree list

# Verify branch deleted
git branch | grep -q "$BRANCH_NAME" && echo "WARNING: Branch still exists" || echo "Branch deleted"
```

---

## Output Format

```markdown
## Feature Branch Cleanup Complete

### Branch: feat/add-user-preferences

### Cleanup Summary

- [x] Worktree removed: ~/wt/aws-cloudformation-media-downloader-add-user-preferences
- [x] Local branch deleted: feat/add-user-preferences
- [x] Remote branch deleted: origin/feat/add-user-preferences (by GitHub)
- [x] Master updated to latest
- [x] GraphRAG regenerated
- [x] Repomix context updated

### Verification

```
$ git worktree list
/Users/jlloyd/Repositories/aws-cloudformation-media-downloader  abc1234 [master]
```

### Remaining Worktrees

None (clean state)

### Next Steps

Ready to start new feature:
```bash
/feature-start <new-feature-name>
```
```

---

## Human Checkpoints

1. **Confirm branch merge status** - If not merged, confirm intentional deletion
2. **Review uncommitted changes** - If any exist, decide to commit or discard
3. **Confirm remote branch deletion** - Usually handled by GitHub PR merge

---

## Force Mode

For cleaning up abandoned branches:

```bash
# Force cleanup without merge check
/feature-finish add-user-preferences --force
```

With `--force`:
- Skips merge verification
- Forces worktree removal even with changes
- Deletes branch regardless of state

**CHECKPOINT**: Confirm data loss is acceptable.

---

## Error Handling

### Worktree Not Found

```bash
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "Worktree not found: $WORKTREE_PATH"
  echo "Only cleaning up branches..."
  # Continue with branch cleanup
fi
```

### Cannot Remove Worktree

```bash
if ! git worktree remove "$WORKTREE_PATH" 2>/dev/null; then
  echo "Cannot remove worktree normally"
  echo "Using force removal..."
  git worktree remove "$WORKTREE_PATH" --force
fi
```

### Branch Has Dependents

```bash
# Check if other worktrees use this branch
DEPENDENT=$(git worktree list | grep "$BRANCH_NAME" | grep -v "$WORKTREE_PATH")
if [ -n "$DEPENDENT" ]; then
  echo "ERROR: Branch is used by another worktree: $DEPENDENT"
  exit 1
fi
```

---

## Batch Cleanup

Clean up all merged feature branches:

```bash
# List all feature worktrees
git worktree list | grep 'feat/' | while read worktree branch; do
  # Check if merged
  if git branch --merged origin/master | grep -q "$branch"; then
    echo "Cleaning up merged branch: $branch"
    /feature-finish $(echo "$branch" | sed 's/feat\///')
  fi
done
```

---

## Notes

- Always verify branch is merged before cleanup
- Worktree removal is irreversible - uncommitted changes are lost
- Remote branches are usually deleted by GitHub on PR merge
- Use `git worktree prune` to clean up stale worktree references
