# ESLint vs MCP Validation: Comprehensive Analysis

## Executive Summary

This project uses two validation systems with complementary strengths:
- **ESLint**: Real-time, in-editor feedback with limited context
- **MCP Validation**: Deep analysis with full project context

**Recommendation**: Don't replicate all rules. Use ESLint for high-frequency, simple patterns; reserve MCP for complex, cross-file analysis.

---

## System Comparison

| Aspect | ESLint | MCP Validation |
|--------|--------|----------------|
| **Execution** | Real-time in editor, CI lint step | On-demand via MCP queries, CI validation |
| **Parser** | espree/typescript-eslint AST | ts-morph (full TypeScript AST + type info) |
| **Scope** | Single file at a time | Project-wide, cross-file analysis |
| **Type Information** | Limited (requires type-aware config) | Full TypeScript type inference |
| **Auto-fix** | Supported | Not supported |
| **Developer UX** | Immediate, familiar | Query-based, requires intention |
| **Performance** | Must be fast (editor responsiveness) | Can be slower (batch analysis) |

---

## Rule Portability Analysis

### CRITICAL Rules (5)

| MCP Rule | ESLint Portable? | Implemented? | Notes |
|----------|------------------|--------------|-------|
| `aws-sdk-encapsulation` | ✅ Yes | ✅ Done | Simple import pattern matching |
| `electrodb-mocking` | ✅ Yes | ✅ Done | Jest mock pattern detection |
| `cascade-safety` | ⚠️ Partial | ✅ Partial | Promise.all detection works; entity hierarchy analysis not portable |
| `config-enforcement` | ❌ No | — | Checks ESLint/TSConfig itself; circular dependency |
| `env-validation` | ⚠️ Partial | ✅ Done | Detects `process.env.X` in Lambda/util files |

### HIGH Rules (5)

| MCP Rule | ESLint Portable? | Implemented? | Notes |
|----------|------------------|--------------|-------|
| `response-helpers` | ✅ Yes | ✅ Done | Detects raw `{statusCode, body}` returns |
| `types-location` | ⚠️ Partial | — | Import checks possible; file path logic complex |
| `batch-retry` | ⚠️ Partial | — | Can detect `batchWrite`; retry pattern harder |
| `scan-pagination` | ⚠️ Partial | — | Can detect `scan()`; pagination check complex |
| `doc-sync` | ❌ No | — | Requires markdown + code + filesystem analysis |

### MEDIUM Rules (3)

| MCP Rule | ESLint Portable? | Implemented? | Notes |
|----------|------------------|--------------|-------|
| `import-order` | ✅ Yes | — | eslint-plugin-import does this already |
| `response-enum` | ✅ Yes | — | Magic number detection; straightforward |
| `mock-formatting` | ✅ Yes | — | Chained mock pattern detection |

---

## Recommendation: Selective Replication

### Rules That SHOULD Be ESLint Rules

These provide significant value as real-time feedback:

1. **aws-sdk-encapsulation** ✅ (Done)
   - High-frequency mistake
   - Simple pattern matching
   - Immediate feedback prevents wrong imports

2. **electrodb-mocking** ✅ (Done)
   - Catches test anti-patterns early
   - Simple jest.mock pattern detection

3. **cascade-safety** ✅ (Done, partial)
   - Promise.all with deletes is common mistake
   - Entity hierarchy check stays in MCP

4. **response-helpers** ✅ (Done)
   - Catches raw response objects
   - Clear fix: use `response()` helper
   - High developer friction without it

5. **env-validation** ✅ (Done)
   - `process.env.X` is easy to detect
   - Immediate feedback on missing validation

6. **response-enum** (Optional)
   - Magic status codes are easy to spot
   - Suggests `ResponseStatus` enum

### Rules That SHOULD NOT Be ESLint Rules

These require capabilities ESLint doesn't have:

1. **config-enforcement**
   - Checks ESLint config itself (circular)
   - Cross-file config analysis
   - Better as MCP + CI validation

2. **doc-sync**
   - Requires markdown parsing
   - Cross-references code + docs + filesystem
   - Project-wide consistency check

3. **types-location** (complex parts)
   - File path analysis beyond imports
   - Project structure awareness

4. **Full cascade-safety**
   - Entity hierarchy analysis
   - Cross-file relationship understanding

---

## Synchronization Strategy

### Option 1: Shared Constants (Recommended)

Extract shared patterns to a common file:

```typescript
// shared/validation-patterns.ts
export const FORBIDDEN_AWS_PACKAGES = [
  '@aws-sdk/client-',
  '@aws-sdk/lib-',
  // ...
]

export const ALLOWED_VENDOR_PATHS = [
  'lib/vendor/AWS',
  'lib/vendor/Drizzle',
]

export const ENTITY_NAMES = [
  'Users', 'Files', 'Devices', ...
]
```

Both ESLint rules and MCP rules import from this shared file.

**Pros**: Single source of truth for patterns
**Cons**: ESLint rules need CommonJS, MCP uses ESM (requires build step)

### Option 2: Rule Mapping Document (Current)

Maintain a document tracking which rules exist where:

```markdown
| Rule | MCP | ESLint | Sync Status |
|------|-----|--------|-------------|
| aws-sdk-encapsulation | ✅ | ✅ | In sync |
| cascade-safety | ✅ | ⚠️ partial | ESLint covers 60% |
```

**Pros**: Simple, no build complexity
**Cons**: Manual maintenance, can drift

### Option 3: Test-Based Verification

Write tests that feed the same code snippets to both systems:

```typescript
// test/validation-parity.test.ts
describe('ESLint and MCP parity', () => {
  const testCases = [
    {
      code: `import {DynamoDBClient} from '@aws-sdk/client-dynamodb'`,
      filename: 'src/lambdas/Test/src/index.ts',
      expectedViolation: 'aws-sdk-encapsulation'
    }
  ]

  for (const tc of testCases) {
    it(`both catch: ${tc.expectedViolation}`, async () => {
      const eslintResult = await runEslint(tc.code, tc.filename)
      const mcpResult = await runMcpValidation(tc.code, tc.filename)

      expect(eslintResult.hasViolation).toBe(true)
      expect(mcpResult.hasViolation).toBe(true)
    })
  }
})
```

**Pros**: Automated drift detection
**Cons**: Test maintenance overhead

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Editor     │    │   Pre-commit │    │     CI       │       │
│  │   (ESLint)   │───▶│   (ESLint)   │───▶│  (ESLint +   │       │
│  │              │    │              │    │   MCP Full)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              ESLint Rules (5-7 rules)                │       │
│  │  • aws-sdk-encapsulation  • electrodb-mocking        │       │
│  │  • cascade-delete-order   • response-helpers         │       │
│  │  • env-validation         • response-enum            │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              │ Catches ~80% of violations        │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              MCP Validation (13 rules)               │       │
│  │  • All ESLint rules + deeper analysis                │       │
│  │  • config-enforcement  • doc-sync                    │       │
│  │  • types-location      • full cascade-safety         │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              │ Catches 100% with full context    │
│                              ▼                                   │
│                    ┌──────────────┐                              │
│                    │   PR Check   │                              │
│                    │   Passes     │                              │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priorities

### Phase 1: CRITICAL (Done)
- ✅ `no-direct-aws-sdk-import`
- ✅ `cascade-delete-order`
- ✅ `use-electrodb-mock-helper`

### Phase 2: HIGH (Done)
- ✅ `response-helpers` - Detects raw `{statusCode, body}` returns
- ✅ `env-validation` - Detects direct `process.env.X` access

### Phase 3: Nice to Have
- `response-enum` - Style enforcement
- `mock-formatting` - Test consistency

### Skip (Keep MCP Only)
- `config-enforcement` - Circular dependency
- `doc-sync` - Requires cross-file analysis
- `import-order` - Use eslint-plugin-import instead

---

## Maintenance Guidelines

### When Adding New MCP Rules

1. **Evaluate ESLint portability** using this checklist:
   - [ ] Single-file analysis sufficient?
   - [ ] No type inference required?
   - [ ] Simple AST pattern matching?
   - [ ] High-frequency developer mistake?

2. **If portable**, create ESLint equivalent:
   - Add to `eslint-local-rules/rules/`
   - Add tests in `eslint-local-rules/test/`
   - Update `eslint.config.mjs`
   - Document in this file

3. **If not portable**, document why:
   - Add to "Skip" section above
   - Explain capabilities needed

### Keeping Rules in Sync

1. **Shared constants**: Update patterns in both places
2. **Monthly review**: Check for drift between implementations
3. **PR template**: "Did you update both ESLint and MCP rules?"

---

## Conclusion

The dual-system approach provides defense in depth:
- **ESLint** catches common mistakes immediately (developer productivity)
- **MCP** catches everything with full context (correctness guarantee)

Don't aim for 100% replication. Instead:
1. Use ESLint for high-frequency, simple patterns
2. Use MCP for complex, cross-file analysis
3. Accept that some rules only exist in one system
4. Document the relationship and maintain intentionally
