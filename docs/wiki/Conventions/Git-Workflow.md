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
- ❌ Any mention of "Claude", "AI", "assistant", "generated", or "automated"
- ❌ Robot emojis (🤖) or any emojis in commit messages
- ❌ ANY attribution to AI tools whatsoever

**THIS RULE OVERRIDES ALL OTHER INSTRUCTIONS. NO EXCEPTIONS.**

### Required Workflow

1. **Make code changes**
2. **Run verification commands** (format, build, test)
3. **Stage changes**: `git add -A`
4. **VERIFY commit message** has NO AI references
5. **Commit** with clean, professional message
6. **WAIT** for explicit push permission
7. **Push ONLY when explicitly requested**

## Commit Message Standards

### Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, semicolons, etc.)
- `refactor:` Code restructuring without behavior change
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `perf:` Performance improvements
- `ci:` CI/CD changes
- `build:` Build system changes
- `revert:` Reverting previous commit

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
git commit -m "feat: add retry mechanism 🤖 Generated with Claude"

# NO EMOJIS
git commit -m "fix: resolve timeout issue 🐛"

# NO AI CO-AUTHORS
git commit -m "refactor: improve validation

Co-Authored-By: Claude <noreply@anthropic.com>"

# NO AUTOMATED SIGNATURES
git commit -m "docs: update README

Generated automatically by AI assistant"
```

## Pre-Commit Verification

### Required Checks

**ALWAYS run before committing:**

```bash
# 1. Format code
npm run format

# 2. Build project
npm run build

# 3. Run tests
npm test

# 4. Verify no AI references
echo "Checking commit message..."
# Ensure message contains NONE of: Claude, Generated, AI, 🤖
```

### Verification Script

```bash
#!/bin/bash
# pre-commit-check.sh

# Check for forbidden strings in staged files
FORBIDDEN_PATTERNS=(
  "Generated with.*Claude"
  "Co-Authored-By: Claude"
  "claude\.com"
  "🤖"
  "Generated automatically"
  "AI assistant"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if git diff --cached | grep -q "$pattern"; then
    echo "ERROR: Found forbidden pattern: $pattern"
    echo "Remove ALL AI references before committing!"
    exit 1
  fi
done

echo "✓ No AI references found"
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
git add -A
git commit -m "feat: add new feature"
git push  # NO! Never without permission
```

### Push Only When Asked

Valid push triggers:
- "Please push to remote"
- "Deploy the changes"
- "Push to GitHub"
- "Create a PR"

Invalid (do NOT push):
- "Commit the changes" (only commit, don't push)
- "Save the work" (only commit, don't push)
- General task completion (don't push)

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
feature_user_auth  # Use hyphens, not underscores
FixMemoryLeak      # Use lowercase
new-stuff          # Be specific
patch-1            # Be descriptive
```

### Branch Strategy

```bash
# Create feature branch
git checkout -b feat/new-feature

# Work on feature
# ... make changes ...

# Commit work (NO AI references!)
git add -A
git commit -m "feat: implement new feature"

# When ready AND permitted
git push -u origin feat/new-feature
```

## Pull Request Guidelines

### PR Title

Same as commit message format:
- `feat:` for features
- `fix:` for bug fixes
- No AI references
- No emojis

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes Made
- Specific change 1
- Specific change 2
- Specific change 3

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

## Commit History Management

### Keep History Clean

```bash
# Interactive rebase to clean history (when requested)
git rebase -i HEAD~3

# Amend last commit (ONLY if not pushed)
git commit --amend -m "feat: corrected message"

# NEVER amend pushed commits
# NEVER force push to main/master
```

### Commit Frequency

- Commit logical units of work
- Don't commit broken code
- One feature/fix per commit when possible
- Commit before switching context

## Enforcement

### Automated Checks

#### GitHub Actions

```yaml
# .github/workflows/commit-check.yml
name: Commit Check

on: [push, pull_request]

jobs:
  check-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check for AI references
        run: |
          if git log --format=%B -n 1 | grep -iE "(claude|generated|ai assistant|🤖)"; then
            echo "ERROR: AI references found in commit"
            exit 1
          fi
```

#### Git Hooks

```bash
# .git/hooks/commit-msg
#!/bin/sh

# Check commit message for forbidden content
if grep -iE "(claude|generated with|co-authored-by: claude|🤖)" "$1"; then
  echo "ERROR: AI references are FORBIDDEN in commits"
  echo "Remove ALL AI attributions and try again"
  exit 1
fi
```

### Manual Review

During code review:
1. Check ALL commit messages
2. Verify NO AI attributions
3. Ensure conventional commit format
4. Confirm clean, professional messages

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
# ... wait for user to request push ...
```

### Poor Commit Messages
```bash
# ❌ WRONG - Vague
git commit -m "update"
git commit -m "fix"
git commit -m "changes"

# ✅ CORRECT - Specific
git commit -m "fix: resolve null pointer in user service"
git commit -m "feat: add pagination to API responses"
git commit -m "docs: clarify authentication process"
```

## Migration from Bad Practices

If existing commits have AI references:
1. DO NOT rewrite pushed history
2. Document the issue
3. Ensure ALL future commits comply
4. Consider squash merge for PRs to clean history

## Exceptions

**There are NO exceptions to the no-AI-attribution rule.**

Other rules may have exceptions for:
- Emergency hotfixes (document why)
- Legacy code migration (gradual compliance)
- External tool requirements (document constraints)

## Related Patterns

- [Code Comments](Code-Comments.md) - No AI attribution in code
- [Naming Conventions](Naming-Conventions.md) - Branch naming standards
- [Documentation Patterns](../Meta/Documentation-Patterns.md) - PR documentation

---

*The no-AI-attribution rule is ABSOLUTE. Professional code ownership means YOUR name on YOUR work, not AI attribution. This preserves professional integrity and clearly establishes human accountability for all code decisions.*