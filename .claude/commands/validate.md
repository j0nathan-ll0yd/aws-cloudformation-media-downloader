# Convention Validator

Validate code against project conventions using the MCP AST-based validation rules. Identifies violations and generates fix suggestions.

## Quick Start

```bash
# Validate all files
pnpm run validate:conventions

# Validate specific file
# Use MCP: validate_pattern with file parameter
```

## Workflow

### Step 1: Run Validation

Query the MCP server to validate patterns:

```
MCP Tool: validate_pattern
Query: all
```

This runs all 20 AST validation rules:
- 7 CRITICAL rules (must fix before commit)
- 9 HIGH rules (should fix)
- 4 MEDIUM rules (recommended)

### Step 2: Categorize Results

Group violations by severity:

| Severity | Action Required |
|----------|-----------------|
| CRITICAL | Block commit - must fix immediately |
| HIGH | Require acknowledgment or fix |
| MEDIUM | Auto-fix or warn |

### Step 3: Generate Fixes

For each violation, use the apply convention tool:

```
MCP Tool: apply_convention
Convention: [aws-sdk-wrapper | entity-mock | response-helper | env-validation | powertools]
File: [path to file]
DryRun: true (preview first)
```

### Step 4: Review and Apply

For each fix suggestion:

1. **Preview the diff** (dry-run mode)
2. **Assess impact** - will this change behavior?
3. **Apply if safe** - set dryRun to false
4. **Re-validate** - ensure fix resolved the issue

## Convention Rules Reference

### CRITICAL Rules (Zero Tolerance)

| Rule | Description | Fix |
|------|-------------|-----|
| `aws-sdk-direct-import` | No direct AWS SDK imports | Use vendor wrappers from `#lib/vendor/AWS/` |
| `entity-direct-import` | No direct entity module imports | Use `#entities/queries` |
| `env-var-module-level` | No module-level `getRequiredEnv()` | Move to inside functions |
| `vendor-bypass` | No bypassing vendor encapsulation | Always use wrapper methods |
| `secrets-in-code` | No hardcoded secrets | Use SOPS or environment |

### HIGH Rules (Should Fix)

| Rule | Description | Fix |
|------|-------------|-----|
| `raw-response-object` | No raw Lambda response objects | Use `response()` helper |
| `underscore-unused-vars` | No `_var` for unused params | Destructure only needed |
| `promise-all-cascade` | No Promise.all for cascades | Use Promise.allSettled |
| `missing-powertools` | Lambda missing Powertools | Add tracer/logger/metrics |
| `try-catch-required-env` | Try-catch on required config | Let it fail fast |
| `missing-type-annotation` | Mock without type | Add explicit mock types |
| `direct-console-log` | Console.log in Lambda | Use Powertools logger |
| `missing-test-file` | Lambda without tests | Generate test scaffold |
| `missing-error-handling` | No error handling in handler | Add try-catch with logging |

### MEDIUM Rules (Recommended)

| Rule | Description | Fix |
|------|-------------|-----|
| `missing-tsdoc` | Export without TSDoc | Add documentation |
| `long-function` | Function > 50 lines | Extract helper functions |
| `deep-nesting` | > 3 levels of nesting | Refactor to early returns |
| `magic-numbers` | Unexplained numeric literals | Extract to named constants |

## Batch Validation

For validating multiple files or entire directories:

### Validate All Lambdas

```bash
# Check all Lambda handlers
for f in src/lambdas/*/src/index.ts; do
  echo "Validating $f..."
  # Use MCP validate_pattern
done
```

### Validate Changed Files

```bash
# Get files changed in current branch
git diff --name-only origin/master...HEAD | grep '\.ts$' | while read f; do
  echo "Validating $f..."
  # Use MCP validate_pattern
done
```

## Pre-Commit Integration

Add to `.husky/pre-commit`:

```bash
# Run convention validation on staged TypeScript files
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$' || true)
if [ -n "$STAGED_TS" ]; then
  pnpm run validate:conventions
fi
```

## Fix Workflows

### Fix: AWS SDK Direct Import

**Before**:
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
```

**After**:
```typescript
import { getDynamoDBClient } from '#lib/vendor/AWS/DynamoDB';
```

### Fix: Raw Response Object

**Before**:
```typescript
return {
  statusCode: 200,
  body: JSON.stringify(data)
};
```

**After**:
```typescript
import { response } from '#util/response';
return response(200, data);
```

### Fix: Module-Level Environment Variable

**Before**:
```typescript
const CONFIG = getRequiredEnv('CONFIG'); // At module level

export const handler = async () => { ... };
```

**After**:
```typescript
export const handler = async () => {
  const CONFIG = getRequiredEnv('CONFIG'); // Inside function
  ...
};
```

## Output Format

The validation report should be formatted as:

```
## Validation Report

### CRITICAL (2 violations) - Must fix before commit

1. **aws-sdk-direct-import** in `src/lambdas/ListFiles/src/index.ts:5`
   - Direct import of `@aws-sdk/client-dynamodb`
   - Fix: Use `import { getDynamoDBClient } from '#lib/vendor/AWS/DynamoDB'`

2. **env-var-module-level** in `src/lambdas/LoginUser/src/index.ts:8`
   - `getRequiredEnv('JWT_SECRET')` called at module level
   - Fix: Move inside handler function

### HIGH (1 violation) - Should fix

1. **raw-response-object** in `src/lambdas/RegisterDevice/src/index.ts:45`
   - Returning raw `{ statusCode, body }` object
   - Fix: Use `response(200, data)` helper

### Summary
- CRITICAL: 2 (blocking)
- HIGH: 1
- MEDIUM: 0
- Total: 3 violations
```

## Human Checkpoints

1. **CRITICAL violations**: Must be fixed before proceeding - blocks commit
2. **HIGH violations**: Review each suggested fix before applying
3. **Preview all auto-fixes**: Always review dryRun output before applying
4. **MEDIUM violations**: Can be auto-fixed or deferred to later

---

## Batch Fix Capability

For fixing multiple violations at once:

### Step 1: Identify Fixable Violations

```
MCP Tool: validate_pattern
Query: summary
```

This groups violations by fixability:
- **Auto-fixable**: Can be applied automatically
- **Manual-fix**: Requires developer intervention
- **Deferred**: Low priority, can wait

### Step 2: Preview Batch Fixes

```
MCP Tool: apply_convention
Convention: all
File: [file with violations]
DryRun: true
```

Review the proposed changes for each file.

### Step 3: Generate Migration Script

For large-scale fixes across multiple files:

```
MCP Tool: generate_migration
Query: plan
Convention: all
Scope: ["src/lambdas/**/*.ts"]
```

This creates a migration plan showing all files and fixes.

### Step 4: Execute Batch Fix (With Confirmation)

**CHECKPOINT**: Before applying, confirm:
- [ ] Preview reviewed and approved
- [ ] Tests will be updated if needed
- [ ] Backup exists (git commit)

```
MCP Tool: generate_migration
Query: script
Convention: all
Execute: true
```

### Step 5: Re-validate

```
MCP Tool: validate_pattern
Query: all
```

Confirm all violations are resolved.

---

## Fix by Convention Type

### AWS SDK Violations

```
MCP Tool: apply_convention
Convention: aws-sdk-wrapper
File: [file]
DryRun: false
```

### Response Helper Violations

```
MCP Tool: apply_convention
Convention: response-helper
File: [file]
DryRun: false
```

### Environment Validation

```
MCP Tool: apply_convention
Convention: env-validation
File: [file]
DryRun: false
```

---

## Notes

- Always run in dry-run mode first
- Re-validate after applying fixes
- Some violations may require manual refactoring
- Update test files if fixes change function signatures
- Commit between fix batches for easier rollback
