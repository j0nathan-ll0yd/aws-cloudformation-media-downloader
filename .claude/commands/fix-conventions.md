# Interactive Convention Fixing

Identify and fix convention violations interactively with preview and batch capabilities.

## Quick Start

```bash
# Usage: /fix-conventions
# Or target specific file: /fix-conventions src/lambdas/ListFiles/src/index.ts
```

## Workflow

### Step 1: Identify Violations

Run validation to find all violations:

```
MCP Tool: validate_pattern
Query: all
```

Group results by severity:
- **CRITICAL**: Must fix immediately (blocks commit)
- **HIGH**: Should fix before merge
- **MEDIUM**: Recommended improvements

### Step 2: Categorize by Fixability

```
MCP Tool: validate_pattern
Query: summary
```

Categorizes violations as:
- **Auto-fixable**: Can be applied with MCP tools
- **Semi-auto**: Requires parameter choices
- **Manual**: Requires developer intervention

### Step 3: Preview Auto-Fixes

For each file with auto-fixable violations:

```
MCP Tool: apply_convention
Convention: all
File: [file path]
DryRun: true
```

**CHECKPOINT**: Review each proposed change before applying.

### Step 4: Apply Fixes Interactively

For each category of violation:

#### AWS SDK Violations

```
MCP Tool: apply_convention
Convention: aws-sdk-wrapper
File: [file]
DryRun: false
```

#### Response Helper Violations

```
MCP Tool: apply_convention
Convention: response-helper
File: [file]
DryRun: false
```

#### Environment Validation

```
MCP Tool: apply_convention
Convention: env-validation
File: [file]
DryRun: false
```

#### Powertools Integration

```
MCP Tool: apply_convention
Convention: powertools
File: [file]
DryRun: false
```

### Step 5: Handle Manual Fixes

For violations requiring manual intervention:

1. Present the violation details
2. Show the recommended fix pattern
3. Open file for editing
4. Guide through the fix
5. Re-validate after change

### Step 6: Re-validate

After all fixes applied:

```
MCP Tool: validate_pattern
Query: all
```

Confirm all violations resolved.

### Step 7: Run Tests

```bash
pnpm test
```

Ensure fixes didn't break tests.

---

## Human Checkpoints

1. **Review violation list** - Confirm priorities
2. **Preview each fix** - Approve before applying
3. **Confirm batch operations** - Before applying to multiple files
4. **Validate test results** - After all fixes applied

---

## Batch Fix Mode

For fixing multiple files at once:

### Generate Migration Plan

```
MCP Tool: generate_migration
Query: plan
Convention: all
Scope: ["src/lambdas/**/*.ts"]
```

### Preview Migration Script

```
MCP Tool: generate_migration
Query: script
Convention: all
OutputFormat: ts-morph
```

### Execute Migration

**CHECKPOINT**: Confirm before executing:
- [ ] All previews reviewed
- [ ] Git status clean (changes committed)
- [ ] Tests currently passing

```
MCP Tool: generate_migration
Query: script
Convention: all
Execute: true
```

---

## Fix Patterns Reference

### AWS SDK Direct Import

**Before**:
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
```

**After**:
```typescript
import { getDynamoDBClient } from '#lib/vendor/AWS/DynamoDB';
```

### Raw Response Object

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

### Module-Level Environment Variable

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

### Promise.all for Cascade Deletions

**Before**:
```typescript
await Promise.all([deleteUser(), deleteUserFiles()]);
```

**After**:
```typescript
await Promise.allSettled([deleteUserFiles(), deleteUser()]); // Children first
```

---

## Output Format

```markdown
## Convention Fix Report

### Summary
- **Total Violations Found**: 15
- **Auto-Fixed**: 12
- **Manual Fixes Required**: 3
- **Remaining**: 0

### Fixes Applied

| File | Violation | Fix Applied |
|------|-----------|-------------|
| src/lambdas/ListFiles/src/index.ts | aws-sdk-direct-import | Replaced with vendor wrapper |
| src/lambdas/LoginUser/src/index.ts | raw-response-object | Added response helper |

### Manual Fixes Completed

| File | Violation | Action Taken |
|------|-----------|--------------|
| src/utils/auth.ts | complex-refactor | Extracted function |

### Validation
- [x] All violations resolved
- [x] Tests pass
- [x] Type check passes

### Commit Ready
```bash
git add -A
git commit -m 'fix: resolve convention violations

- Replace direct AWS SDK imports with vendor wrappers
- Add response helpers to Lambda handlers
- Fix module-level environment variables'
```
```

---

## Rollback

If fixes cause issues:

```bash
# Undo all changes
git checkout -- .

# Or revert specific file
git checkout -- src/lambdas/[name]/src/index.ts
```

---

## Notes

- Always preview before applying fixes
- Commit between fix batches for easier rollback
- Update tests if fixes change function signatures
- Re-run full CI after all fixes: `pnpm run ci:local`
