# Library Migration Checklist

## Quick Reference
- **When to use**: Replacing major libraries
- **Enforcement**: Required for breaking changes
- **Impact if violated**: HIGH - Production failures

## Migration Phases

### 1. Planning
- Document current usage: `grep -r "old-library" src/`
- Check feature parity
- Review breaking changes

### 2. Parallel Implementation
```typescript
// lib/vendor/Wrapper.ts
export function getClient() {
  if (process.env.USE_NEW) {
    return newLibrary.create()
  }
  return oldLibrary.create()
}
```

### 3. Incremental Migration
- [ ] Install new library alongside old
- [ ] Create vendor wrapper with flag
- [ ] Migrate one Lambda at a time
- [ ] Test in staging
- [ ] Monitor metrics

### 4. Validation
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance acceptable
- [ ] No memory leaks

### 5. Cleanup
- [ ] Remove feature flag
- [ ] Uninstall old library
- [ ] Update documentation

## Common Migrations

### AWS SDK v2 → v3
```bash
npm uninstall aws-sdk
npm install @aws-sdk/client-*
# Update webpack externals
```

### Jest Major Version
```bash
npm update jest @jest/globals @types/jest
# Check migration guide for config changes
```

### Drizzle ORM Updates
```bash
npm update drizzle-orm drizzle-kit
# Test all entity queries
```

## Rollback Strategy

1. Keep old library during migration
2. Use environment variable switch
3. Monitor error rates
4. Quick revert if needed

## Testing Requirements

✅ All unit tests pass
✅ Integration tests with LocalStack
✅ Load testing completed
✅ Error handling verified
✅ Rollback tested

## Related Patterns

- [Dependabot Resolution](Dependabot-Resolution.md)
- [Vendor Wrappers](../Conventions/Vendor-Encapsulation-Policy.md)

---

*Migrate gradually with feature flags and vendor wrappers.*