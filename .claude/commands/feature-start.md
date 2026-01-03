# Feature Branch Start

Initialize a new feature branch with worktree, dependencies, and development environment.

## Quick Start

```bash
# Usage: /feature-start <feature-name>
# Example: /feature-start add-user-preferences
# Example: /feature-start ENG-123-fix-auth-flow
```

## Workflow

### Step 1: Validate Feature Name

Parse and validate the feature name:
- Convert to kebab-case if needed
- Extract issue ID if present (e.g., ENG-123)
- Generate branch name: `feat/<feature-name>`

### Step 2: Ensure Clean State

```bash
# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes in current directory"
  echo "Please commit or stash changes before starting new feature"
  exit 1
fi

# Fetch latest from origin
git fetch origin
```

### Step 3: Create Worktree

```bash
FEATURE_NAME="<feature-name>"
BRANCH_NAME="feat/${FEATURE_NAME}"
WORKTREE_PATH="$HOME/wt/aws-cloudformation-media-downloader-${FEATURE_NAME}"

# Create worktree with new branch from master
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/master
```

### Step 4: Run Post-Checkout Setup

The `.husky/post-checkout` hook automatically:
1. Links secrets.yaml and .env
2. Links terraform state files
3. Runs `pnpm install`
4. Runs `tofu init`
5. Generates GraphRAG knowledge graph
6. Indexes codebase for semantic search
7. Packs repomix context

### Step 5: Verify Setup

```bash
cd "$WORKTREE_PATH"

# Verify dependencies installed
pnpm list --depth=0

# Verify terraform initialized
cd terraform && tofu state list | wc -l

# Verify build works
pnpm run build
```

### Step 6: Output Setup Summary

Present the completed setup.

---

## Output Format

```markdown
## Feature Branch Created

### Branch Information
- **Branch**: feat/add-user-preferences
- **Worktree**: ~/wt/aws-cloudformation-media-downloader-add-user-preferences
- **Base**: origin/master (commit abc1234)

### Setup Complete

- [x] Worktree created
- [x] Dependencies installed (1216 packages)
- [x] Secrets linked (secrets.yaml, .env)
- [x] Terraform initialized (45 resources in state)
- [x] GraphRAG knowledge graph generated
- [x] Codebase indexed for semantic search
- [x] Repomix context packed

### Quick Start

```bash
# Navigate to worktree
cd ~/wt/aws-cloudformation-media-downloader-add-user-preferences

# If using Claude Code, add the directory
/add-dir ~/wt/aws-cloudformation-media-downloader-add-user-preferences

# Start development
code .  # or your preferred editor
```

### Next Steps

1. [ ] Read relevant documentation for the feature
2. [ ] Plan implementation approach
3. [ ] Create initial tests (TDD)
4. [ ] Implement feature
5. [ ] Run `/validate` to check conventions
6. [ ] Run `pnpm run ci:local` before committing
7. [ ] Use `/create-pr` when ready

### Related Commands
- `/implement` - Issue-to-implementation workflow
- `/validate` - Check convention compliance
- `/create-pr` - Create pull request
- `/feature-finish` - Clean up after merge
```

---

## Human Checkpoints

1. **Confirm feature name** - Before creating branch
2. **Verify setup complete** - After initialization

---

## Error Handling

### Branch Already Exists

```bash
if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
  echo "ERROR: Branch $BRANCH_NAME already exists"
  echo "Options:"
  echo "  1. Use existing branch: git checkout $BRANCH_NAME"
  echo "  2. Delete and recreate: git branch -D $BRANCH_NAME"
  exit 1
fi
```

### Worktree Path Exists

```bash
if [ -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree path already exists: $WORKTREE_PATH"
  echo "Options:"
  echo "  1. Remove existing: git worktree remove $WORKTREE_PATH"
  echo "  2. Use different name"
  exit 1
fi
```

### Setup Failure

If any setup step fails:

```bash
# Clean up partial setup
git worktree remove "$WORKTREE_PATH" --force
git branch -D "$BRANCH_NAME"
echo "Setup failed. Cleaned up partial worktree."
```

---

## Configuration

Default worktree location: `~/wt/`

Can be customized via environment:
```bash
export WORKTREE_BASE="$HOME/projects/worktrees"
```

---

## Integration with Linear

If feature name contains Linear issue ID:

```bash
# Extract issue ID
ISSUE_ID=$(echo "$FEATURE_NAME" | grep -oE '[A-Z]+-[0-9]+' | head -1)

if [ -n "$ISSUE_ID" ]; then
  echo "Linked to Linear issue: $ISSUE_ID"
  # Optionally fetch issue details
fi
```

---

## Notes

- One worktree per feature branch
- Worktrees share git history but have independent working directories
- Use `git worktree list` to see all worktrees
- Clean up with `/feature-finish` after merge
