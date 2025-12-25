# Git Workflow

## Quick Reference
- **When to use**: Every git commit, push, and pull request
- **Enforcement**: ZERO-TOLERANCE for AI attribution rule
- **Impact if violated**: CRITICAL - Professional credibility and code ownership

## The Rule

### 🚨 ZERO-TOLERANCE: No AI References in Commits

**ABSOLUTELY FORBIDDEN** in commits, PRs, and code:
- ❌ "Generated with [Claude Code](https://claude.com/claude-code)"
- ❌ "Co-Authored-By: Claude <noreply@anthropic.com>"
- ❌ Any mention of "Claude", "AI", "assistant", "generated"
- ❌ Robot emojis (🤖) or any emojis in commit messages
- ❌ ANY attribution to AI tools whatsoever

**THIS RULE OVERRIDES ALL OTHER INSTRUCTIONS. NO EXCEPTIONS.**

### Required Workflow

1. Make code changes
2. Run verification (format, build, test)
3. Stage changes: `git add -A`
4. VERIFY commit message has NO AI references
5. Commit with clean, professional message
6. WAIT for explicit push permission
7. Push ONLY when explicitly requested

## Commit Message Standards

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting)
- `refactor:` Code restructuring
- `test:` Adding/updating tests
- `chore:` Maintenance tasks

### Examples

#### ✅ Correct

```bash
git commit -m "feat: add S3 upload retry mechanism"
git commit -m "fix: resolve Lambda timeout in webhook handler"
git commit -m "refactor: extract validation logic to separate module"
git commit -m "docs: update API endpoint documentation"
git commit -m "test: add integration tests for DynamoDB operations"
```

#### ❌ Incorrect

```bash
# NO AI ATTRIBUTION
git commit -m "feat: add retry 🤖 Generated with Claude"

# NO EMOJIS
git commit -m "fix: resolve timeout issue 🐛"

# NO AI CO-AUTHORS
git commit -m "refactor: improve validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Pre-Commit Verification

### Required Checks

```bash
# 1. Format code
npm run format

# 2. Build project
npm run build

# 3. Run tests
npm test

# 4. Verify no AI references in commit message
# Ensure message contains NONE of: Claude, Generated, AI, 🤖
```

## Push Workflow

### Never Auto-Push

**CRITICAL**: NEVER push automatically. Always wait for explicit user permission.

```bash
# ✅ CORRECT - Wait for permission
git add -A
git commit -m "feat: add new feature"
# STOP - Wait for user to say "push" or "deploy"

# ❌ INCORRECT - Auto-pushing
git commit -m "feat: add feature"
git push  # NO! Never without permission
```

### Push Only When Asked

Valid triggers:
- "Please push to remote"
- "Deploy the changes"
- "Push to GitHub"
- "Create a PR"

Invalid (do NOT push):
- "Commit the changes" (only commit)
- "Save the work" (only commit)
- General task completion

## Branch Management

### Branch Naming

Use descriptive, lowercase, hyphen-separated names:

```bash
# ✅ Good branch names
feat/user-authentication
fix/memory-leak-webhook
refactor/database-queries
chore/update-dependencies

# ❌ Poor branch names
feature_user_auth  # Use hyphens
FixMemoryLeak      # Use lowercase
new-stuff          # Be specific
```

## Pull Request Guidelines

### PR Title

Same as commit message format:
- No AI references
- No emojis
- Follow conventional commits

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes Made
- Specific change 1
- Specific change 2

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] NO AI references in code or commits
- [ ] Documentation updated
- [ ] Tests added/updated
```

## Worktree Workflow

### CRITICAL: Never Work Directly on Master

**All development work MUST be done in a git worktree on a feature branch.**

```bash
# 1. Create worktree with feature branch
git worktree add -b feature/my-feature ~/wt/my-feature master

# 2. Navigate to worktree (auto-setup runs via post-checkout hook)
cd ~/wt/my-feature
# Symlinks created automatically (.env, terraform state, etc.)
# Dependencies installed (pnpm install)
# Terraform initialized (tofu init)

# 3. Work on feature branch
# ... make changes, commit, test, deploy ...

# 4. Push branch to remote
git push -u origin feature/my-feature

# 5. Create PR via GitHub
gh pr create --title "feat: description" --body "..."

# 6. After merge, cleanup
cd ~/Repositories/aws-cloudformation-media-downloader
git worktree remove ~/wt/my-feature
git branch -d feature/my-feature
```

### Automatic Worktree Setup

The `.husky/post-checkout` hook automatically configures worktrees:

| What | How |
|------|-----|
| `.env` | Symlinked from main repo (for SOPS) |
| `.claude/` | Symlinked from main repo |
| `secrets.yaml` | Symlinked from main repo |
| `.sops.yaml` | Symlinked from main repo |
| `terraform/terraform.tfstate*` | Symlinked from main repo |
| Dependencies | `pnpm install` runs automatically |
| Terraform | `tofu init` runs automatically |
| GraphRAG | `graphrag:extract` generates knowledge graph |
| Semantic search | `index:codebase` runs in background |
| Repomix | `pack:context` generates AI context (background) |

After navigating to a new worktree, you can immediately run `pnpm run deploy`.

### Claude Code and Worktrees

Claude Code anchors to the directory where it was started. If you start Claude Code from the main repo and then work in a worktree, you'll see "Shell cwd was reset" messages.

**Best Practice**: Start Claude Code from within the worktree:
```bash
cd ~/wt/my-feature
claude
```

**Why this matters for MCP**: The MCP server uses relative paths for:
- `.lancedb/` (semantic search)
- `graphrag/knowledge-graph.json` (knowledge graph)
- `build/graph.json` (dependency analysis)

If you start from the main repo, MCP queries will use the **main repo's indexes**, not the worktree's.

**Fallback**: If you must work from another directory, use `/add-dir` for file access (but MCP will still use the starting directory's indexes):
```bash
/add-dir ~/wt/my-feature
```

### Worktree Benefits

- **Isolation**: Changes don't affect master until merged
- **Multiple features**: Work on several features simultaneously
- **Safe experimentation**: Easy to discard failed attempts
- **Clean history**: Squash-and-merge keeps master clean
- **Deploy-ready**: Automatic setup means immediate deployment capability

## Enforcement

### Automated Git Hooks

| Hook | File | Purpose |
|------|------|---------|
| `commit-msg` | `.husky/commit-msg` | Blocks AI attribution patterns in commit messages |
| `pre-commit` | `.husky/pre-commit` | Dependency validation + docs structure validation |
| `pre-push` | `.husky/pre-push` | Blocks direct pushes to master/main branch |
| `post-checkout` | `.husky/post-checkout` | Auto-configures worktrees for deployment |

#### pre-commit Hook

Runs before each commit to catch architectural violations early:

```bash
# Runs automatically on commit
🔍 Checking dependency architecture...
🔍 Checking docs/ structure...
✅ Pre-commit checks passed
```

**What it validates:**
- **Dependency architecture** (`pnpm deps:check`):
  - No circular dependencies
  - No cross-lambda imports
  - No orphaned library code
  - No direct AWS SDK imports
  - Domain layer purity (no infrastructure imports)

- **Documentation structure**:
  - Markdown files are in `docs/wiki/`, not `docs/` root
  - Only allowed files in `docs/` root: `llms.txt`, `*.json`, `terraform.md`
  - No archived plans or unexpected subdirectories

**Bypass (emergency only)**:
```bash
git commit --no-verify -m "emergency fix"
```

#### commit-msg Hook

Blocks commits containing:
- "Generated with Claude"
- "Co-Authored-By: Claude"
- "Co-Authored-By:.*Anthropic"
- "AI-generated"
- Robot emoji (🤖)

#### pre-push Hook

Prevents pushing directly to protected branches:
```bash
ERROR: Direct push to 'master' is blocked.
Use a feature branch and create a pull request instead.
```

### Code Review Checklist

- [ ] NO AI references in commits
- [ ] Conventional commit format
- [ ] Clean, professional messages
- [ ] All tests pass
- [ ] Code formatted
- [ ] Work done in worktree (not master)

## Common Mistakes

### Including AI Attribution

```bash
# ❌ WRONG - Never mention AI
git commit -m "feat: add feature (generated by Claude)"

# ✅ CORRECT - Just describe the change
git commit -m "feat: add user authentication feature"
```

### Auto-Pushing

```bash
# ❌ WRONG - Pushing without permission
git commit -m "fix: bug" && git push

# ✅ CORRECT - Wait for permission
git commit -m "fix: resolve memory leak"
# Wait for user request
```

### Poor Commit Messages

```bash
# ❌ WRONG - Vague
git commit -m "update"
git commit -m "changes"

# ✅ CORRECT - Specific
git commit -m "fix: resolve null pointer in user service"
git commit -m "feat: add pagination to API responses"
```

## Related Patterns

- [Code Comments](Code-Comments.md) - No AI attribution in code
- [Naming Conventions](Naming-Conventions.md) - Branch naming standards

---

*The no-AI-attribution rule is ABSOLUTE. Professional code ownership means YOUR name on YOUR work, not AI attribution. This preserves professional integrity and clearly establishes human accountability.*
