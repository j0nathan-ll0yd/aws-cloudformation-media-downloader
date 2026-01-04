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
| Import patterns | MCP rule (ts-morph) | `src/mcp/validation/rules/` |
| Code structure | MCP rule (ts-morph) | `src/mcp/validation/rules/` |
| Naming patterns | MCP rule (ts-morph) | `src/mcp/validation/rules/` |
| Test patterns | ESLint rule | `eslint-local-rules/rules/` |
| SQL/migration patterns | MCP rule (file parsing) | `src/mcp/validation/rules/` |
| Build-time checks | Script | `bin/` or `scripts/` |

### Step 3: Research Existing Patterns

**For MCP rules:**
```
MCP Tool: validate_pattern
Query: rules
```

Find similar rules in `src/mcp/validation/rules/` to use as templates:
- `aws-sdk-encapsulation.ts` - Import pattern detection
- `cascade-safety.ts` - Code structure validation
- `naming-conventions.ts` - Naming pattern enforcement
- `comment-conventions.ts` - File content analysis

**For ESLint rules:**
Review `eslint-local-rules/rules/` for patterns:
- `no-direct-aws-sdk-import.cjs` - Import detection
- `cascade-delete-order.cjs` - AST pattern matching
- `env-validation.cjs` - Function call validation

### Step 4: Implement the Rule

#### MCP Rule Structure

1. **Create rule file**: `src/mcp/validation/rules/{rule-name}.ts`

```typescript
import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'rule-name'
const SEVERITY = 'CRITICAL' as const  // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export const ruleNameRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Clear description of what this rule enforces',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts'],  // Glob patterns
  excludes: ['**/*.test.ts'],   // Optional exclusions

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Use ts-morph to analyze the AST
    // Return violations with line numbers and suggestions

    return violations
  }
}
```

2. **Create test file**: `src/mcp/validation/rules/{rule-name}.test.ts`

3. **Register in index**: `src/mcp/validation/index.ts`
   - Import the rule
   - Add to `allRules` array (grouped by severity)
   - Add to `rulesByName` with aliases
   - Export individually

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
# For MCP rules
pnpm test src/mcp/validation/rules/{rule-name}.test.ts
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
- **Type**: MCP / ESLint
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Files**:
  - `src/mcp/validation/rules/{rule-name}.ts`
  - `src/mcp/validation/rules/{rule-name}.test.ts`

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
- MCP Validation: `src/mcp/validation/`
- ESLint Local Rules: `eslint-local-rules/`
- Example MCP Rule: `src/mcp/validation/rules/aws-sdk-encapsulation.ts`
- Example ESLint Rule: `eslint-local-rules/rules/no-direct-aws-sdk-import.cjs`
