# Code Review Agent

Automated code review that analyzes PRs for convention violations, security issues, test coverage, and breaking changes.

## Quick Start

```bash
# Review current branch against base
# Trigger: /review or on PR open
```

## Workflow

### Step 1: Gather PR Context

```bash
# Get PR number if on a PR branch
PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null)

# Get changed files
git diff --name-only origin/master...HEAD

# Get detailed diff
git diff origin/master...HEAD
```

### Step 2: Convention Validation

Run AST-based validation on all changed TypeScript files:

```
MCP Tool: validate_pattern
Query: all
File: [each changed .ts file]
```

Categorize violations by severity:
- **CRITICAL**: Must block PR
- **HIGH**: Should fix before merge
- **MEDIUM**: Recommendation

### Step 3: Security Analysis

Check for common vulnerabilities (OWASP Top 10):

| Check | Pattern | Severity |
|-------|---------|----------|
| SQL Injection | Raw SQL with string concat | CRITICAL |
| Command Injection | `exec()`, `spawn()` with user input | CRITICAL |
| XSS | Unescaped HTML output | HIGH |
| Secrets | Hardcoded API keys, passwords | CRITICAL |
| Insecure Deserialization | `JSON.parse` on untrusted input | MEDIUM |
| Missing Auth | Handler without authorization check | HIGH |

### Step 4: Test Coverage Analysis

For each changed file, verify test coverage:

```
MCP Tool: check_coverage
File: [changed source file]
Query: missing
```

Flag issues:
- Source file changed but no test update
- New functions without test coverage
- Reduced coverage percentage

### Step 5: Breaking Change Detection

For changes to exports or APIs:

```
MCP Tool: diff_semantic
Query: breaking
BaseRef: origin/master
HeadRef: HEAD
```

Breaking changes to flag:
- Exported function signature changed
- Required parameter added
- Return type changed
- Enum value removed
- Entity schema modified

### Step 6: Impact Analysis

Determine blast radius of changes:

```
MCP Tool: lambda_impact
File: [changed file]
Query: all
```

Identify:
- Which Lambdas are affected
- Which tests need to pass
- Infrastructure changes needed

### Step 7: Generate Review Comments

Format findings as GitHub PR review comments:

```markdown
## Code Review Summary

### Convention Violations

#### CRITICAL (Blocking)
- [ ] **aws-sdk-direct-import** in `src/lambdas/NewLambda/src/index.ts:15`
  - Direct AWS SDK import detected
  - Suggestion: Use `import { getDynamoDBClient } from '#lib/vendor/AWS/DynamoDB'`

#### HIGH (Should Fix)
- [ ] **missing-test-coverage** in `src/lambdas/NewLambda/src/index.ts`
  - New handler function `processEvent` has no test coverage
  - Suggestion: Add test cases for success and error paths

### Security Findings

No security issues detected.

### Breaking Changes

- **WARNING**: Export signature changed in `src/utils/auth.ts`
  - Function `validateToken` now requires additional parameter
  - 3 dependent files may need updates

### Test Coverage

| File | Before | After | Status |
|------|--------|-------|--------|
| src/lambdas/NewLambda/src/index.ts | N/A | 0% | ⚠️ New file |
| src/utils/helper.ts | 85% | 82% | ⚠️ Decreased |

### Recommendations

1. Add tests for new Lambda handler
2. Update dependent files for auth function change
3. Consider extracting long function (52 lines) at line 78

---
*Automated review by Code Review Agent*
```

## Review Criteria

### Auto-Approve Conditions

PRs may be auto-approved if:
- Only documentation changes
- Only test additions (no source changes)
- Dependency bumps with passing CI
- Format-only changes

### Require Human Review

Always require human review for:
- Security-sensitive code (auth, crypto)
- Database schema changes
- Infrastructure modifications
- Breaking API changes
- Changes to CRITICAL paths

## Comment Templates

### Convention Violation

```markdown
**Convention Violation**: `[rule-name]`

📍 Location: `[file]:[line]`

**Issue**: [Description of the violation]

**Suggestion**:
\`\`\`typescript
// Suggested fix
\`\`\`

📚 Reference: [docs/wiki/Conventions/[relevant-guide].md]
```

### Security Issue

```markdown
**Security Issue**: `[severity]`

📍 Location: `[file]:[line]`

**Issue**: [Description of the security risk]

**Risk**: [Potential impact if exploited]

**Remediation**:
\`\`\`typescript
// Secure alternative
\`\`\`

📚 Reference: [OWASP link or internal doc]
```

### Missing Test

```markdown
**Test Coverage Gap**

📍 Location: `[file]:[function]`

**Issue**: New or modified code lacks test coverage

**Suggestion**: Add test cases covering:
- [ ] Happy path
- [ ] Error handling
- [ ] Edge cases

**Scaffold**:
\`\`\`typescript
it('should [expected behavior]', async () => {
  // Arrange
  // Act
  // Assert
});
\`\`\`
```

## Integration

### GitHub Actions

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Code Review Agent
        run: |
          # Run MCP validation
          pnpm run validate:conventions

      - name: Post Review Comments
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            // Post review comments from validation output
```

### Pre-Push Hook

```bash
# .husky/pre-push
#!/bin/sh

# Run lightweight review before push
pnpm run validate:conventions
if [ $? -ne 0 ]; then
  echo "Convention violations detected. Fix before pushing."
  exit 1
fi
```

## Human Checkpoints

1. **Review generated comments** before posting to PR
2. **Verify security findings** - avoid false positives
3. **Assess breaking change impact** - may be intentional
4. **Decide on auto-approve eligibility**

## Notes

- Review is additive - doesn't replace human review
- Focus on objective, verifiable issues
- Avoid style preferences (handled by formatter)
- Link to documentation for each finding
- No AI attribution in posted comments
