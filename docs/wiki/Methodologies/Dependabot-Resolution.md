# Dependabot Resolution

## Quick Reference
- **When to use**: Handling dependency updates
- **Enforcement**: Automated via GitHub Actions
- **Impact if violated**: MEDIUM - Security vulnerabilities

## Auto-Merge Rules

### ✅ Auto-Merge When
- Patch version (x.x.PATCH)
- All tests passing
- Dev dependencies only
- No breaking changes

### 🔍 Manual Review When
- Minor/major versions
- Production dependencies
- AWS SDK updates
- Security alerts

## Resolution Process

```bash
# 1. Check what changed
pnpm outdated
pnpm audit

# 2. Update and test
pnpm update <package>
pnpm test
pnpm run build

# 3. Verify
pnpm audit
git commit -m "chore(deps): update <package>"
```

## Common Issues

| Update Type | Action |
|------------|--------|
| Security alert | Fix immediately |
| Major version | Check migration guide |
| Type errors | Update @types packages |
| AWS SDK | Update all @aws-sdk/* together |
| Jest | Update all jest packages together |

## AWS SDK Special Handling

```bash
# Update all AWS packages together
pnpm update @aws-sdk/client-*

# Add new services to webpack externals
externals: ['@aws-sdk/client-new-service']
```

## Priority Levels

1. **Critical Security** - Fix immediately
2. **High Security** - Within 24 hours
3. **Production Deps** - Within week
4. **Dev Dependencies** - Next sprint

## Related Patterns

- [Library Migration](Library-Migration-Checklist.md)
- [Testing Strategy](../Testing/Vitest-Mocking-Strategy.md)

---

*Auto-merge patch updates. Review minor/major versions and production dependencies.*