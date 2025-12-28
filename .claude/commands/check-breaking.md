# Breaking Change Detection

Detect breaking changes in entities, APIs, and exports that could affect consumers (iOS app, other Lambdas).

## Quick Start

```bash
# Check for breaking changes in current branch
# Usage: /check-breaking
# Or compare specific refs: /check-breaking origin/master HEAD
```

## What Constitutes a Breaking Change

### CRITICAL - Will Break Consumers

| Change | Impact | Example |
|--------|--------|---------|
| Required field added | Existing data won't have it | `userId: string` added to existing entity |
| Field removed | Consumers expect it | `name` field deleted |
| Type changed | Parse/serialize fails | `id: number` → `id: string` |
| Enum value removed | Existing data invalid | `FileStatus.Pending` removed |
| Export removed | Import fails | `export { helper }` deleted |
| Parameter added (required) | Callers break | `fn(a)` → `fn(a, b)` |
| Return type changed | Consumers can't parse | `string` → `{ value: string }` |

### WARNING - May Break Consumers

| Change | Impact | Example |
|--------|--------|---------|
| Optional field added | Usually safe | `email?: string` added |
| Enum value added | May need handling | `FileStatus.Processing` added |
| Parameter added (optional) | Usually safe | `fn(a, b?)` |
| Behavior changed | Logic differs | Validation stricter |

## Workflow

### Step 1: Identify Changed Files

Get files that could contain breaking changes:

```bash
# Entity files
git diff --name-only origin/master...HEAD | grep -E '^src/entities/.*\.ts$'

# Type files
git diff --name-only origin/master...HEAD | grep -E '^src/types/.*\.ts$'

# TypeSpec API definitions
git diff --name-only origin/master...HEAD | grep -E '^typespec/.*\.tsp$'

# Lambda handlers (exports)
git diff --name-only origin/master...HEAD | grep -E '^src/lambdas/.*/src/index\.ts$'
```

### Step 2: Analyze Schema Changes

Use semantic diff for entity/type changes:

```
MCP Tool: diff_semantic
Query: breaking
BaseRef: origin/master
HeadRef: HEAD
Scope: entities
```

Parse the diff for:

```typescript
// Field changes
interface Before { id: string; name: string; }
interface After { id: string; email: string; } // name removed, email added

// Type changes
type Status = 'active' | 'inactive';  // Before
type Status = 'active' | 'disabled';  // After - 'inactive' removed
```

### Step 3: Analyze Export Changes

Check for removed or changed exports:

```bash
# Get exports from base
git show origin/master:src/path/file.ts | grep -E '^export '

# Get exports from head
git show HEAD:src/path/file.ts | grep -E '^export '

# Compare
```

Use AST analysis for function signatures:

```
MCP Tool: diff_semantic
Query: breaking
Scope: src
```

### Step 4: Check API Contract Changes

For TypeSpec files:

```bash
# Compare generated OpenAPI specs
cd typespec && tsp compile . --emit @typespec/openapi3

# Diff the generated OpenAPI
diff -u old-openapi.yaml new-openapi.yaml
```

API breaking changes:
- Endpoint removed
- Required parameter added
- Response schema changed
- Authentication requirements changed

### Step 5: Calculate Impact

For each breaking change, identify affected consumers:

```
MCP Tool: lambda_impact
File: [changed file]
Query: dependents
```

Impact categories:

| Consumer | Detection | Action |
|----------|-----------|--------|
| iOS App | API/Entity change | Requires app update |
| Other Lambdas | Import dependency | Must update imports |
| Tests | Mock/fixture | Update test data |
| External APIs | TypeSpec change | Version API |

### Step 6: Generate Migration Strategy

For each breaking change, propose migration:

#### Field Removed

```typescript
// Before: Remove field
entity.name = undefined; // DON'T DO THIS

// After: Add migration
// 1. Add deprecation warning
// 2. Stop writing to field
// 3. Stop reading from field
// 4. Remove from schema after grace period
```

#### Type Changed

```typescript
// Before: number
{ id: 123 }

// After: string
// Migration: Update all existing records
// 1. Add new field: idString
// 2. Migrate data: idString = String(id)
// 3. Update consumers to use idString
// 4. Remove old id field
```

#### Required Field Added

```typescript
// Before: { name: string }
// After: { name: string; email: string }

// Migration:
// 1. Make field optional first: email?: string
// 2. Backfill existing records
// 3. Make field required after backfill
```

### Step 7: Check iOS Compatibility

For API changes that affect the iOS app:

```markdown
## iOS App Impact Assessment

### Changed Endpoints
| Endpoint | Change | App Version Required |
|----------|--------|---------------------|
| GET /files | Response field removed | 2.1.0+ |
| POST /auth | New required header | 2.0.5+ |

### Entity Changes
| Entity | Change | Migration |
|--------|--------|-----------|
| File | status enum changed | Update FileStatus enum |
| User | email now required | Backfill or default |

### Recommendation
- [ ] Coordinate release with iOS team
- [ ] Version API endpoint if significant
- [ ] Document changes in release notes
```

## Output Format

```markdown
## Breaking Change Detection Report

### Summary
- **CRITICAL**: 2 breaking changes detected
- **WARNING**: 3 potential issues
- **Affected Consumers**: iOS App, 5 Lambdas

---

### CRITICAL Changes

#### 1. Field Removed: `User.legacyId`

**File**: `src/entities/Users.ts:45`

**Change**: Field `legacyId` was removed from User entity

**Impact**:
- iOS App: Uses this field for backward compatibility
- Lambdas: LoginUser, RegisterUser reference this field

**Migration Required**:
1. Verify no consumers still need this field
2. If needed, deprecate with warning first
3. Backfill data if migrating to new field

**Diff**:
\`\`\`diff
- legacyId: varchar('legacy_id', { length: 36 }),
\`\`\`

---

#### 2. Type Changed: `FileStatus`

**File**: `src/types/enums.ts:12`

**Change**: Enum value `Pending` renamed to `Queued`

**Impact**:
- Existing records have `Pending` status
- iOS App expects `Pending` value

**Migration Required**:
1. Add `Queued` as new value (keep `Pending`)
2. Update all code to use `Queued`
3. Migrate database records
4. Remove `Pending` after iOS app update

---

### WARNING Changes

#### 1. New Required Parameter

**File**: `src/utils/auth.ts:78`

**Change**: Function `validateToken` now requires `options` parameter

**Impact**: Internal only - 3 Lambda files need update

**Action**: Update callers to pass options

---

### Migration Plan

1. [ ] Hold PR until iOS 2.1.0 is released
2. [ ] Add database migration script for FileStatus
3. [ ] Update affected Lambdas to new signatures
4. [ ] Coordinate rollout plan

### Rollback Strategy

If issues occur:
\`\`\`bash
git revert HEAD
tofu apply  # Restore previous infrastructure
\`\`\`

---

*Generated by Breaking Change Detection*
```

## Human Checkpoints

1. **Review classification** - Confirm CRITICAL vs WARNING
2. **Approve migration plan** - Before implementation
3. **Coordinate with iOS team** - For app-impacting changes

## Integration

### Pre-Push Hook

```bash
# .husky/pre-push
#!/bin/sh

# Check for breaking changes
BREAKING=$(git diff --name-only origin/master...HEAD | grep -E '^src/(entities|types)/.*\.ts$')
if [ -n "$BREAKING" ]; then
  echo "⚠️  Entity/Type changes detected - verify no breaking changes"
  echo "$BREAKING"
fi
```

### CI Integration

```yaml
name: Breaking Change Check
on:
  pull_request:
    paths:
      - 'src/entities/**'
      - 'src/types/**'
      - 'typespec/**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect Breaking Changes
        run: |
          # Run semantic diff
          # Post warning comment if breaking changes found
```

## Notes

- Always prefer additive changes over breaking changes
- Use deprecation periods for removals
- Version APIs when breaking changes are unavoidable
- Coordinate with iOS team for app-impacting changes
- Document all breaking changes in release notes
