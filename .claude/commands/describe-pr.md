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

### Step 5: Check Impact

Use MCP tools to understand impact:

```bash
# For each modified source file, check dependents
# This helps identify what else might be affected
```

Query the MCP server:
- Use `lambda_impact` for Lambda changes
- Use `query_dependencies` for import chain analysis
- Use `diff_semantic` for breaking change detection

### Step 6: Generate Description

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

### Step 7: Output

Present the generated description for review. The human should:
1. Review and adjust the summary
2. Verify impact analysis is accurate
3. Add any missing context
4. Copy to GitHub PR

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
