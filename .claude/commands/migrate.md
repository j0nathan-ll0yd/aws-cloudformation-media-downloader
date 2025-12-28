# Migration Assistant

Guide complex migrations (schema, dependency, API) with staged commits, rollback checkpoints, and impact analysis.

## Quick Start

```bash
# Usage: /migrate <type>
# Types: schema, dependency, api

# Examples:
# /migrate schema    - Database schema migration
# /migrate dependency - Package version migration
# /migrate api       - API contract migration
```

## Migration Types

| Type | Description | Risk Level |
|------|-------------|------------|
| `schema` | Entity/database schema changes | HIGH |
| `dependency` | Package version upgrades with breaking changes | MEDIUM-HIGH |
| `api` | TypeSpec/OpenAPI contract changes | HIGH |

## Workflow

### Step 1: Analyze Current State

Gather context about what's being migrated:

```
MCP Tool: query_entities
Query: schema
Entity: [target entity if schema migration]
```

```
MCP Tool: query_infrastructure
Resource: all
Query: dependencies
```

### Step 2: Calculate Blast Radius

Determine what will be affected:

```
MCP Tool: lambda_impact
File: [migration target]
Query: all
```

Output:
- Dependent Lambdas
- Affected tests
- Infrastructure changes needed
- iOS app impact

### Step 3: Generate Migration Plan

Create a phased plan with rollback points:

```markdown
## Migration Plan: [Migration Name]

### Overview
- **Type**: [schema | dependency | api]
- **Target**: [What's being migrated]
- **Risk**: [HIGH | MEDIUM-HIGH]
- **Estimated Steps**: [N]

### Pre-Migration Checklist
- [ ] Backup current state
- [ ] Notify stakeholders
- [ ] Verify rollback procedure
- [ ] Clear deployment queue

### Phase 1: Preparation
**Rollback Point: RP-1**

1. Create feature branch
2. Add new schema/code alongside old
3. Ensure backward compatibility
4. Tests pass with both old and new

**Commit**: `chore(migration): prepare [name] migration`

### Phase 2: Migration
**Rollback Point: RP-2**

1. Migrate data/code to new format
2. Update all consumers
3. Run full test suite
4. Validate in staging

**Commit**: `feat(migration): migrate to [new format]`

### Phase 3: Cleanup
**Rollback Point: RP-3**

1. Remove old schema/code
2. Update documentation
3. Final test validation
4. Deploy to production

**Commit**: `chore(migration): cleanup [name] migration`

### Rollback Procedures

**RP-1 (Preparation phase)**:
\`\`\`bash
git reset --hard HEAD~1
\`\`\`

**RP-2 (Migration phase)**:
\`\`\`bash
git reset --hard RP-1-commit-hash
# Revert any data migrations
\`\`\`

**RP-3 (Cleanup phase)**:
\`\`\`bash
git revert HEAD
# Old code still exists, consumers unaffected
\`\`\`
```

### Step 4: CHECKPOINT - Plan Approval

Present the migration plan for human approval before proceeding.

**Questions to confirm**:
1. Is the blast radius acceptable?
2. Are rollback procedures tested?
3. Is there a maintenance window?
4. Are stakeholders notified?

### Step 5: Execute Migration (Phased)

#### Schema Migration Example

**Phase 1: Add New Field (Backward Compatible)**

```typescript
// src/entities/Users.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }), // NEW - optional first
});
```

**Phase 2: Migrate Data**

```typescript
// Run migration script
await db.execute(sql`
  UPDATE users
  SET email = COALESCE(email, CONCAT(name, '@placeholder.com'))
  WHERE email IS NULL
`);
```

**Phase 3: Make Required & Remove Old**

```typescript
// After data is migrated
email: varchar('email', { length: 255 }).notNull(),
```

#### Dependency Migration Example

**Phase 1: Add Compatibility Layer**

```typescript
// util/compat.ts
export const legacyAdapter = (newApi) => {
  return {
    oldMethod: newApi.newMethod,
  };
};
```

**Phase 2: Update Consumers**

```typescript
// Update each consumer file
import { newMethod } from 'new-package';
// instead of
import { oldMethod } from 'old-package';
```

**Phase 3: Remove Compatibility Layer**

```bash
# Remove compat.ts and old package
pnpm remove old-package
```

#### API Migration Example

**Phase 1: Add New Endpoint**

```typescript
// Add new endpoint alongside old
// GET /api/v2/files - new format
// GET /api/v1/files - still works
```

**Phase 2: Migrate Clients**

```markdown
- Update iOS app to use v2
- Update any external integrations
- Monitor v1 usage
```

**Phase 3: Deprecate Old Endpoint**

```typescript
// Add deprecation header
response.headers['Deprecation'] = 'true';
response.headers['Sunset'] = '2025-03-01';
```

### Step 6: Validate Each Phase

After each phase:

```bash
# Type check
pnpm run check-types

# Tests
pnpm test

# Full CI
pnpm run ci:local:full
```

### Step 7: Final Verification

```bash
# Run integration tests
pnpm run test:integration

# Verify in staging environment
pnpm run test-remote-list
```

## Migration Templates

### Schema Migration Checklist

- [ ] Backup database
- [ ] Create migration branch
- [ ] Add new columns/tables as nullable
- [ ] Update entity definitions
- [ ] Run Drizzle migration
- [ ] Backfill data
- [ ] Update Lambda handlers
- [ ] Update tests
- [ ] Make columns required (if needed)
- [ ] Remove old columns (after grace period)
- [ ] Update documentation
- [ ] Deploy to production

### Dependency Migration Checklist

- [ ] Identify breaking changes
- [ ] Create migration branch
- [ ] Update package.json
- [ ] Fix type errors
- [ ] Update deprecated API usage
- [ ] Run tests
- [ ] Verify bundle size
- [ ] Check cold start impact
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production

### API Migration Checklist

- [ ] Version new endpoint
- [ ] Implement new handler
- [ ] Add tests for new endpoint
- [ ] Update TypeSpec definitions
- [ ] Generate new OpenAPI spec
- [ ] Notify API consumers
- [ ] Set deprecation timeline
- [ ] Monitor old endpoint usage
- [ ] Remove old endpoint

## Output Format

```markdown
## Migration Complete: [Name]

### Summary
- **Type**: Schema migration
- **Duration**: 3 phases over 2 PRs
- **Rollback Used**: No

### Changes Applied

| Phase | Commit | Status |
|-------|--------|--------|
| 1. Preparation | abc123 | ✓ Complete |
| 2. Migration | def456 | ✓ Complete |
| 3. Cleanup | ghi789 | ✓ Complete |

### Validation Results

| Check | Result |
|-------|--------|
| Type check | ✓ Pass |
| Unit tests | ✓ Pass (247 tests) |
| Integration tests | ✓ Pass |
| Staging deployment | ✓ Verified |

### Post-Migration

- [ ] Monitor error rates for 24h
- [ ] Update runbooks
- [ ] Close migration issue
- [ ] Archive migration branch

### Rollback (if needed)

\`\`\`bash
# To rollback to pre-migration state:
git revert ghi789 def456 abc123

# Or restore from backup:
# [Database restore instructions]
\`\`\`
```

## Human Checkpoints

1. **Plan approval** - Before any migration starts
2. **Phase completion** - After each phase, before proceeding
3. **Production deployment** - Final approval before prod
4. **Post-migration monitoring** - Confirm stable for 24h

## Risk Mitigation

### Before Migration
- Take database snapshots
- Document rollback procedures
- Test rollback in staging
- Schedule during low-traffic period

### During Migration
- Monitor error rates
- Keep communication channel open
- Have rollback scripts ready
- Don't proceed if issues arise

### After Migration
- Monitor for 24-48 hours
- Keep rollback capability for 1 week
- Document lessons learned
- Update runbooks

## Notes

- Never rush migrations
- Always have rollback tested
- Communicate early and often
- Prefer multiple small migrations over one large
- Document everything for future reference
