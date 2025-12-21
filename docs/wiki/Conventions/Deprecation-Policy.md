# Deprecation Policy

## Quick Reference
- **When to use**: Removing or replacing functions, APIs, or patterns
- **Enforcement**: Required - Remove immediately, don't deprecate
- **Impact if violated**: HIGH - Accumulates dead code and cleanup debt

## The Rule

**Remove deprecated code immediately. Don't mark it deprecated.**

This is a small project without external consumers. There's no deprecation period, no `@deprecated` JSDoc tags, no transition warnings. When something is replaced, remove the old implementation in the same PR.

## Why No Deprecation Period?

| Concern | Enterprise Projects | This Project |
|---------|--------------------| --------------|
| External consumers | Need migration time | None - internal only |
| Multiple teams | Coordinate changes | Single developer/team |
| Backwards compatibility | Critical | Not applicable |
| API contracts | Published, versioned | Internal, flexible |

Deprecation warnings are a coordination mechanism for large teams and external APIs. They add noise and delay for small projects.

## Examples

### ❌ Incorrect - Adding Deprecation Warning

```typescript
/**
 * @deprecated Use buildApiResponse() instead
 */
export function lambdaErrorResponse(
  context: Context,
  error: Error
): APIGatewayProxyResult {
  console.warn('lambdaErrorResponse is deprecated, use buildApiResponse')
  return buildApiResponse(context, error)
}
```

Problems:
- Dead code remains in codebase
- Callers continue using old function
- Creates cleanup task for "later" (never)
- Documentation references stale APIs

### ✅ Correct - Remove and Replace

```typescript
// 1. Update all callers to use new function
// 2. Remove old function entirely
// 3. Update tests, fixtures, documentation
// 4. All in the same PR

export function buildApiResponse(
  context: Context,
  statusCodeOrError: number | Error,
  body?: unknown
): APIGatewayProxyResult {
  // Single implementation, no backwards compatibility shim
}
```

## The Complete Replacement Checklist

When replacing a function/pattern, update ALL of these in the same PR:

- [ ] Remove old implementation
- [ ] Update all callers in source code
- [ ] Update unit tests
- [ ] Update test fixtures
- [ ] Update MCP validation rules (if applicable)
- [ ] Update ESLint rules (if applicable)
- [ ] Update wiki documentation
- [ ] Update AGENTS.md examples (if applicable)
- [ ] Run full test suite

## Anti-Patterns to Avoid

### "We'll Clean It Up Later"

```typescript
// ❌ BAD - Leaving both implementations
export function oldFunction() { ... }  // "deprecated"
export function newFunction() { ... }  // current

// Some callers use old, some use new
// "We'll migrate the rest eventually"
```

### Wrapper Functions for Compatibility

```typescript
// ❌ BAD - Shim that just calls new function
export function oldName(...args) {
  return newName(...args)  // Just remove oldName entirely
}
```

### Deprecation Comments

```typescript
// ❌ BAD - Comment instead of removal
// DEPRECATED: Use newFunction instead
export function oldFunction() { ... }
```

## When Removal Spans Multiple PRs

For very large changes that genuinely can't fit in one PR:

1. **Create a tracking issue** listing all required changes
2. **Complete all changes** before merging ANY of them
3. **Merge as a single atomic change** (squash or rebase)

Never merge partial migrations. The codebase should never have both old and new patterns in use simultaneously.

## Related Patterns

- [Code Comments](Code-Comments.md) - Git is source of truth, not comments
- [Git Workflow](Git-Workflow.md) - Clean, atomic commits

---

*In a small project, deprecation is just procrastination. Remove it or keep it - there's no middle ground.*
