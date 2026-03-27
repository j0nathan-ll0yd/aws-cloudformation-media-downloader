# Implement Convention

Add automated enforcement for a documented convention that currently relies on code review.

## Quick Start

```bash
# Usage: /implement-convention <convention-name>
# Example: /implement-convention aurora-dsql-create-index-async
```

## Workflow

### Step 1: Identify Convention

1. Read `docs/wiki/Meta/Conventions-Tracking.md`
2. Find the convention by name or description
3. Verify it's currently "Code review" enforcement
4. Locate the detailed documentation in `docs/wiki/`

**CHECKPOINT**: Confirm with user which convention to implement.

### Step 2: Choose Enforcement Method

Based on the convention type:

| Pattern Type | Enforcement Method | Location |
|--------------|-------------------|----------|
| Import patterns | `mantle check` rule | `mantle.config.ts` |
| Code structure | `mantle check` rule | `mantle.config.ts` |
| Naming patterns | `mantle check` rule | `mantle.config.ts` |
| Test patterns | ESLint rule | `eslint-local-rules/rules/` |
| SQL/migration patterns | `mantle check` rule | `mantle.config.ts` |
| Build-time checks | Script | `bin/` or `scripts/` |

### Step 3: Research Existing Patterns

**For `mantle check` rules:**

Review `mantle.config.ts` for existing rule patterns to use as templates. Run `pnpm run validate:conventions` to see all currently enforced rules and their structure.

**For ESLint rules:**
Review `eslint-local-rules/rules/` for patterns:
- `no-direct-aws-sdk-import.cjs` - Import detection
- `cascade-delete-order.cjs` - AST pattern matching
- `env-validation.cjs` - Function call validation

### Step 4: Implement the Rule

#### Mantle Check Rule Structure

Convention enforcement is done via the Mantle CLI's convention validation engine. Add rules to `mantle.config.ts` following the existing rule patterns. Run `pnpm run validate:conventions` to execute all rules.

#### ESLint Rule Structure

1. **Create rule file**: `eslint-local-rules/rules/{rule-name}.cjs`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Rule description',
      category: 'Best Practices'
    },
    messages: {
      violationId: 'Error message shown to user'
    },
    schema: []
  },

  create(context) {
    return {
      // AST visitor methods
      ImportDeclaration(node) { /* ... */ },
      CallExpression(node) { /* ... */ }
    }
  }
}
```

2. **Create test file**: `eslint-local-rules/test/{rule-name}.test.cjs`

3. **Register in index**: `eslint-local-rules/index.cjs`

4. **Enable in config**: `eslint.config.mjs`

### Step 5: Update Documentation

1. **Update tracking file**: `docs/wiki/Meta/Conventions-Tracking.md`
   - Move convention from "Code review" to appropriate enforcement method
   - Update counts in "Enforcement Summary" section
   - Add to MCP Validation Rules or ESLint rules table

2. **Update convention wiki page** with enforcement details

### Step 6: Validate Implementation

```bash
# For mantle check rules
pnpm run validate:conventions

# For ESLint rules
node eslint-local-rules/test/{rule-name}.test.cjs
pnpm run lint

# Full validation
pnpm run precheck
pnpm test
```

---

## Output Format

```markdown
## Convention Implementation Complete

### Rule Created
- **Name**: {rule-name}
- **Type**: mantle check / ESLint
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Files**:
  - `mantle.config.ts` (updated with new rule)
  - `eslint-local-rules/rules/{rule-name}.cjs` (if ESLint rule)

### Documentation Updated
- [x] Conventions-Tracking.md updated
- [x] Wiki page updated with enforcement details

### Validation Results
- [x] Rule tests pass
- [x] Convention validation passes
- [x] Lint passes
- [x] All tests pass
```

---

## Human Checkpoints

1. **Confirm convention choice** - Verify the correct convention is being automated
2. **Approve enforcement method** - Confirm MCP vs ESLint vs script approach
3. **Review rule implementation** - Before committing changes
4. **Verify no false positives** - Ensure existing code doesn't trigger incorrectly

---

## Common Implementation Patterns

### Detecting Forbidden Imports

```typescript
const imports = sourceFile.getImportDeclarations()
for (const importDecl of imports) {
  const module = importDecl.getModuleSpecifierValue()
  if (isForbidden(module)) {
    violations.push(createViolation(...))
  }
}
```

### Checking Function Calls

```typescript
const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
for (const call of calls) {
  const name = call.getExpression().getText()
  if (name === 'forbiddenFunction') {
    violations.push(createViolation(...))
  }
}
```

### Parsing Non-TypeScript Files

```typescript
import {readFileSync} from 'fs'

if (filePath.endsWith('.sql')) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  // Parse line by line
}
```

---

## Related Commands

- `/fix-conventions` - Interactively fix convention violations
- `/validate` - Run all convention validation rules
- `/review` - Code review including convention checks

## References

- Conventions Tracking: `docs/wiki/Meta/Conventions-Tracking.md`
- Mantle Convention Validation: `mantle.config.ts` + `pnpm run validate:conventions`
- ESLint Local Rules: `eslint-local-rules/`
- Example ESLint Rule: `eslint-local-rules/rules/no-direct-aws-sdk-import.cjs`
