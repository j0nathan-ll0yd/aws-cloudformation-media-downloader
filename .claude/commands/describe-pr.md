# PR Description Generator

Generate a comprehensive pull request description by analyzing commits, changed files, and their impact.

## Workflow

### Step 1: Gather Context

First, determine the base branch and analyze the diff:

```bash
# Get the base branch (usually master or main)
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")
CURRENT_BRANCH=$(git branch --show-current)

echo "Comparing $CURRENT_BRANCH against $BASE_BRANCH"
```

### Step 2: Analyze Commits

Review all commits since diverging from base:

```bash
# Get commit log with stats
git log --oneline --stat $BASE_BRANCH..HEAD

# Get detailed commit messages
git log --format="### %s%n%n%b" $BASE_BRANCH..HEAD
```

### Step 3: Analyze Changed Files

Understand the scope of changes:

```bash
# List all changed files with status
git diff --stat $BASE_BRANCH...HEAD

# Get file change summary
git diff --name-status $BASE_BRANCH...HEAD
```

### Step 4: Categorize Changes

Based on the changed files, categorize the PR:

| Pattern | Category |
|---------|----------|
| `src/lambdas/*/src/*.ts` | Lambda implementation |
| `src/lambdas/*/test/*.ts` | Lambda tests |
| `src/entities/*.ts` | Database schema |
| `terraform/*.tf` | Infrastructure |
| `docs/**/*.md` | Documentation |
| `src/mcp/**/*.ts` | MCP tools |
| `package.json`, `pnpm-lock.yaml` | Dependencies |
| `src/types/**/*.ts` | Type definitions |

### Step 5: Extract Linked Issues

Automatically detect linked issues from branch name and commits:

```bash
# Extract issue from branch name (e.g., feat/ENG-123-description)
BRANCH=$(git branch --show-current)
ISSUE_ID=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1)

# Extract issues from commit messages
git log $BASE_BRANCH..HEAD --format="%s %b" | grep -oE '(#[0-9]+|[A-Z]+-[0-9]+)' | sort -u
```

**Supported formats**:
- GitHub: `#123`, `Closes #123`, `Fixes #123`
- Linear: `ENG-123`, `TEAM-456`
- Branch pattern: `feat/ENG-123-description`

### Step 6: Validate Commit Messages

Check commits follow conventional format:

```bash
# Validate commit message format
git log $BASE_BRANCH..HEAD --format="%s" | while read msg; do
  if ! echo "$msg" | grep -qE '^(feat|fix|docs|style|refactor|test|chore)(\([^)]+\))?: .+'; then
    echo "WARNING: Non-conventional commit: $msg"
  fi
done
```

**Convention**: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- No emojis
- No AI attribution

### Step 7: Check Impact

Use MCP tools to understand impact:

```
MCP Tool: lambda_impact
File: [changed file]
Query: all
```

```
MCP Tool: query_dependencies
File: [changed file]
Query: dependents
```

```
MCP Tool: diff_semantic
Query: breaking
BaseRef: origin/master
HeadRef: HEAD
```

These tools provide:
- Affected Lambdas
- Import chain analysis
- Breaking change detection

### Step 8: Generate Description

Create a PR description following this template:

```markdown
## Summary

[1-3 bullet points describing the main changes]

## Changes

### [Category 1]
- [Specific change description]

### [Category 2]
- [Specific change description]

## Impact Analysis

- **Affected Lambdas**: [list or "None"]
- **Database Changes**: [Yes/No - describe if yes]
- **API Changes**: [Yes/No - describe if yes]
- **Breaking Changes**: [Yes/No - describe if yes]

## Test Plan

- [ ] Unit tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm run check-types`)
- [ ] Lint passes (`pnpm run lint`)
- [ ] Local CI passes (`pnpm run ci:local`)
- [ ] [Additional manual test steps if applicable]

## Related

- Closes #[issue-number] (if applicable)
- Related to #[related-pr] (if applicable)
```

### Step 9: Output

Present the generated description for review.

---

## Human Checkpoints

1. **Review summary accuracy** - Ensure bullet points capture the essence of changes
2. **Verify impact analysis** - Confirm affected Lambdas and breaking change detection is accurate
3. **Validate linked issues** - Verify auto-detected issues are correct
4. **Check commit messages** - Address any non-conventional commit warnings
5. **Add missing context** - Include any context the automation missed

---

## Usage Notes

- Run this AFTER all commits are ready but BEFORE creating the PR
- If commits span multiple categories, ensure all are represented
- For dependency updates, reference the upgrade source (Dependabot PR numbers)
- No AI attribution should appear in the final PR description

## Example Output

For a PR that adds a new Lambda function:

```markdown
## Summary

- Add new `ProcessWebhook` Lambda for handling third-party webhook events
- Implement SQS queue integration for async processing
- Add comprehensive unit tests with mock coverage

## Changes

### Lambda Implementation
- New `src/lambdas/ProcessWebhook/src/index.ts` handler
- Event validation using Zod schema
- Error handling with structured logging

### Infrastructure
- New SQS queue `process-webhook-queue`
- IAM role with least-privilege permissions
- CloudWatch alarm for queue depth

### Testing
- Unit tests with 95% coverage
- Mock fixtures for webhook payloads

## Impact Analysis

- **Affected Lambdas**: None (new Lambda)
- **Database Changes**: No
- **API Changes**: Yes - new POST /webhooks/process endpoint
- **Breaking Changes**: No

## Test Plan

- [x] Unit tests pass
- [x] Type check passes
- [x] Lint passes
- [x] Local CI passes
- [ ] Manual test with sample webhook payload
```
