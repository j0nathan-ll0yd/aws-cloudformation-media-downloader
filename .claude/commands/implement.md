# Issue-to-Implementation

Transform an issue (Linear or GitHub) into a working implementation with tests, following a spec-driven approach.

## Quick Start

```bash
# Usage: /implement <issue-url>
# Example: /implement https://linear.app/team/issue/TEAM-123
# Example: /implement https://github.com/owner/repo/issues/456
```

## Prerequisites

- Working in an existing worktree with feature branch
- Issue URL accessible (Linear or GitHub)
- Codebase context loaded

## Workflow

### Step 1: Fetch Issue Details

**For Linear issues:**
```bash
# Extract issue ID from URL
ISSUE_ID=$(echo "$URL" | grep -oE '[A-Z]+-[0-9]+')

# Fetch via Linear API (requires LINEAR_API_KEY)
curl -s -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { issue(id: \"'$ISSUE_ID'\") { title description state { name } priority labels { nodes { name } } } }"}' \
  https://api.linear.app/graphql
```

**For GitHub issues:**
```bash
# Extract owner/repo/number from URL
gh issue view $ISSUE_NUMBER --json title,body,labels
```

### Step 2: Analyze Requirements

Parse the issue to extract:

| Element | Source | Purpose |
|---------|--------|---------|
| Title | Issue title | Brief summary |
| Description | Issue body | Detailed requirements |
| Acceptance Criteria | Checklist items | Success conditions |
| Labels | Issue labels | Type (bug, feature, etc.) |
| Priority | Issue priority | Urgency |

### Step 3: Search for Patterns

Find similar implementations in the codebase:

```
MCP Tool: search_codebase_semantics
Query: [Keywords from issue title/description]
Limit: 10
```

Look for:
- Similar features already implemented
- Relevant utility functions
- Entity patterns to follow
- Test patterns to emulate

### Step 4: Identify Affected Files

Determine which files need modification:

```
MCP Tool: lambda_impact
Query: all
File: [Suspected entry point]
```

Create a file change plan:

| File | Action | Reason |
|------|--------|--------|
| src/lambdas/NewFeature/src/index.ts | CREATE | New handler |
| src/entities/NewEntity.ts | CREATE | New data model |
| src/lambdas/ExistingLambda/src/index.ts | MODIFY | Add integration |
| terraform/lambda-new-feature.tf | CREATE | Infrastructure |

### Step 5: CHECKPOINT - Plan Approval

Present the implementation plan for human approval:

```markdown
## Implementation Plan for [Issue Title]

### Summary
[1-2 sentence description of what will be implemented]

### Changes

#### New Files
- `src/lambdas/NewFeature/src/index.ts` - Handler implementation
- `src/lambdas/NewFeature/test/index.test.ts` - Unit tests
- `terraform/lambda-new-feature.tf` - Infrastructure

#### Modified Files
- `src/entities/index.ts` - Export new entity
- `graphrag/metadata.json` - Add Lambda metadata

### Approach
[Technical approach in 3-5 bullet points]

### Risks
- [Potential issues or considerations]

### Questions
- [Any clarifications needed before proceeding]

---
**Approve this plan before implementation begins.**
```

### Step 6: Implement Changes

After approval, implement in this order:

1. **Types/Interfaces** - Define data structures
2. **Entities** - Database schema if needed
3. **Utilities** - Helper functions
4. **Handler** - Lambda implementation
5. **Tests** - Unit tests with mocks
6. **Infrastructure** - Terraform if needed
7. **Metadata** - Update graphrag/metadata.json

For each file, apply conventions:
```
MCP Tool: apply_convention
Convention: all
File: [new file path]
DryRun: false
```

### Step 7: Generate/Update Tests

Create comprehensive tests:

```
MCP Tool: suggest_tests
File: [new handler path]
Query: scaffold
```

Ensure tests cover:
- [ ] Happy path
- [ ] Input validation errors
- [ ] Database errors
- [ ] Authorization failures
- [ ] Edge cases from requirements

### Step 8: Run Validation

Before committing, validate:

```bash
# Type checking
pnpm run check-types

# Linting
pnpm run lint

# Convention validation
pnpm run validate:conventions

# Unit tests
pnpm test

# Local CI (full)
pnpm run ci:local
```

### Step 9: Create Commit

Commit with clean message (no AI attribution):

```bash
git add -A
git commit -m "feat([scope]): [description]

[Detailed explanation if needed]

Closes [issue-reference]"
```

Commit message guidelines:
- Type: feat, fix, refactor, test, docs, chore
- Scope: Lambda name, entity, or feature area
- Description: Present tense, imperative mood
- No emojis, no AI references

## Implementation Patterns

### New Lambda Pattern

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { logger, tracer } from '#lib/vendor/AWS/Powertools';
import { response } from '#util/response';
import { validateInput } from './validation';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const input = validateInput(event);
    // Implementation
    return response(200, { success: true });
  } catch (error) {
    logger.error('Handler failed', { error });
    return response(500, { error: 'Internal server error' });
  }
};
```

### Entity Access Pattern

```typescript
import { Users } from '#entities/Users';

// Always use entity methods, never direct DB access
const user = await Users.get({ userId });
await Users.update({ userId }, { name: newName });
```

### Error Handling Pattern

```typescript
import { ValidationError, NotFoundError } from '#util/errors';

if (!input.required) {
  throw new ValidationError('Missing required field');
}

const item = await Entity.get({ id });
if (!item) {
  throw new NotFoundError('Item not found');
}
```

## Human Checkpoints

1. **Plan approval** - Before any implementation begins
2. **Test review** - Before committing, verify test coverage
3. **Final review** - Before pushing to remote

## Rollback Strategy

If issues arise after implementation:

```bash
# In worktree, reset to before implementation
git reset --hard HEAD~1

# Or create fixup commit
git revert HEAD
```

## Output Format

On completion:

```markdown
## Implementation Complete

### Issue: [Title]

### Changes Made

| File | Action | Lines |
|------|--------|-------|
| src/lambdas/NewFeature/src/index.ts | Created | +120 |
| src/lambdas/NewFeature/test/index.test.ts | Created | +85 |
| terraform/lambda-new-feature.tf | Created | +45 |

### Test Results

```
✓ NewFeature handler tests (5 tests)
✓ All 247 tests passing
✓ Coverage: 87%
```

### Validation

- [x] Type check passed
- [x] Lint passed
- [x] Convention validation passed
- [x] CI local passed

### Next Steps

1. Push to remote: `git push -u origin feature-branch`
2. Create PR: `/describe-pr`
3. Request review

### Commit

```
feat(NewFeature): implement [feature description]

Closes TEAM-123
```
```

## Notes

- Always work in a worktree, not main repo
- Follow existing patterns in the codebase
- Keep changes focused on the issue scope
- No feature creep - only implement what's specified
- If requirements are unclear, ask before implementing
