# Documentation Gap Analysis

This document identifies documentation gaps discovered during the January 2026 audit, prioritized by severity and business impact.

## Priority Definitions

| Priority | Criteria | Action Required |
|----------|----------|-----------------|
| CRITICAL | Incorrect/misleading information | Fix immediately |
| HIGH | Missing documentation for core patterns | Create in this audit |
| MEDIUM | Incomplete or sparse documentation | Create in this audit |
| LOW | Nice-to-have improvements | Future work |

---

## CRITICAL: Outdated ElectroDB References

The project migrated from ElectroDB to Drizzle ORM, but 6 documentation files still reference the deprecated patterns.

### Files Requiring Updates

| File | Issue | Action |
|------|-------|--------|
| `docs/wiki/Authentication/ElectroDB-Adapter-Design.md` | Entire file obsolete | DELETE |
| `docs/wiki/Meta/Emerging-Conventions.md` | References ElectroDB mocking patterns (2025-11-24 entry) | UPDATE |
| `docs/wiki/MCP/Auto-Fix.md` | References `createElectroDBEntityMock` helper | UPDATE |
| `docs/wiki/MCP/Template-Organization.md` | References `createElectroDBEntityMock` in templates | UPDATE |
| `docs/wiki/Meta/Serverless-Architecture-Assessment.md` | References `electrodb-mock.ts` | UPDATE |
| `docs/wiki/TypeScript/Lambda-Function-Patterns.md` | Uses old entity import syntax | UPDATE |

### Verification Command

```bash
grep -ri "electrodb" docs/wiki/
# Should return 0 results after fixes
```

---

## HIGH: Missing Core Documentation

### 1. Entity Query Patterns

**Gap**: No documentation for the native Drizzle query functions in `src/entities/queries/`.

**Impact**: Developers may use deprecated entity patterns or struggle with the type system.

**Files Affected**:
- `src/entities/queries/user-queries.ts` (8 functions)
- `src/entities/queries/file-queries.ts` (14 functions)
- `src/entities/queries/device-queries.ts` (8 functions)
- `src/entities/queries/session-queries.ts` (20 functions)
- `src/entities/queries/relationship-queries.ts` (17 functions)

**Deliverable**: Create `docs/wiki/TypeScript/Entity-Query-Patterns.md`

**Content Requirements**:
- Query function architecture overview
- Type system: `*Row`, `*Item`, `Create*Input`, `Update*Input`
- Relationship query patterns (joins)
- Transaction handling
- Migration guide from legacy entity imports

---

### 2. Lambda Reference Index

**Gap**: No centralized reference listing all 18 Lambda functions with their triggers and purposes.

**Impact**: Developers must search multiple files to understand Lambda responsibilities.

**Current State**: Information scattered across AGENTS.md and Integration-Test-Coverage.md.

**Deliverable**: Create `docs/wiki/TypeScript/Lambda-Reference-Index.md`

**Content Requirements**:
- Complete table of all 18 Lambdas
- Trigger type for each
- Purpose/description
- Links to source files and test files
- Integration test coverage status

---

### 3. System Library Guide

**Gap**: No unified documentation for `src/lib/system/` utilities.

**Impact**: Resilience patterns, error handling, and observability patterns are undiscoverable.

**Files Needing Documentation**:
| File | Current Coverage |
|------|------------------|
| `circuit-breaker.ts` | Partial (in Resilience-Patterns) |
| `retry.ts` | None |
| `errors.ts` | Partial (in TypeScript-Error-Handling) |
| `env.ts` | Partial (in Lambda-Environment-Variables) |
| `observability.ts` | None |
| `logging.ts` | Partial (in PII-Protection) |

**Deliverable**: Create `docs/wiki/TypeScript/System-Library.md`

---

### 4. Lambda Middleware Expansion

**Gap**: `Lambda-Middleware-Patterns.md` exists but doesn't cover all 10 middleware files.

**Missing Coverage**:
- `correlation.ts` - Correlation ID handling
- `internal.ts` - Internal handler wrapper
- `legacy.ts` - Legacy compatibility patterns
- Detailed validation/sanitization patterns

**Deliverable**: Expand `docs/wiki/TypeScript/Lambda-Middleware-Patterns.md`

---

## MEDIUM: Incomplete Documentation

### 1. External Integrations

**Gap**: YouTube vendor wrapper and GitHub integration have no wiki documentation.

**Files Needing Documentation**:
- `src/lib/vendor/YouTube.ts` - YouTube/yt-dlp wrapper
- `src/lib/integrations/github/` - GitHub issue creation service
- `src/lib/data/pagination.ts` - Data pagination utilities

**Deliverable**: Create `docs/wiki/TypeScript/External-Integrations.md`

---

### 2. Test Helper - AWS Response Factories

**Gap**: `test/helpers/aws-response-factories.ts` not documented.

**Current Coverage**: Other test helpers well-documented in Vitest-Mocking-Strategy.md.

**Deliverable**: Add section to `docs/wiki/Testing/Vitest-Mocking-Strategy.md`

---

## LOW: Quality Improvements

### 1. Bash Script Patterns

**Current Score**: 5/10 - Minimal content, no real project examples.

**Issues**:
- Only 117 lines of content
- No references to actual project scripts
- Missing examples from `bin/` directory
- Color output patterns use non-portable escape codes

**Deliverable**: Expand `docs/wiki/Bash/Script-Patterns.md`

---

### 2. Domain Layer Architecture

**Current Score**: 7/10 - Good principles, sparse examples.

**Issues**:
- Only 123 lines of content
- No examples from actual `src/lib/domain/` files
- Limited migration path guidance

**Deliverable**: Expand `docs/wiki/Architecture/Domain-Layer.md`

---

## Summary of Deliverables

### Files to Create
| File | Priority | Estimated Lines |
|------|----------|-----------------|
| `TypeScript/Entity-Query-Patterns.md` | HIGH | 300-400 |
| `TypeScript/Lambda-Reference-Index.md` | HIGH | 150-200 |
| `TypeScript/System-Library.md` | HIGH | 200-250 |
| `TypeScript/External-Integrations.md` | MEDIUM | 150-200 |

### Files to Update
| File | Priority | Changes |
|------|----------|---------|
| `Meta/Emerging-Conventions.md` | CRITICAL | Fix ElectroDB refs |
| `MCP/Auto-Fix.md` | CRITICAL | Fix ElectroDB refs |
| `MCP/Template-Organization.md` | CRITICAL | Fix ElectroDB refs |
| `Meta/Serverless-Architecture-Assessment.md` | CRITICAL | Fix ElectroDB refs |
| `TypeScript/Lambda-Function-Patterns.md` | CRITICAL | Fix imports |
| `TypeScript/Lambda-Middleware-Patterns.md` | HIGH | Expand coverage |
| `Testing/Vitest-Mocking-Strategy.md` | MEDIUM | Add response factories |
| `Bash/Script-Patterns.md` | LOW | Expand content |
| `Architecture/Domain-Layer.md` | LOW | Expand content |
| `Home.md` | HIGH | Update navigation |

### Files to Delete
| File | Priority | Reason |
|------|----------|--------|
| `Authentication/ElectroDB-Adapter-Design.md` | CRITICAL | Obsolete (Drizzle migration) |

---

## Related Documentation

- [Documentation Coverage Matrix](Documentation-Coverage-Matrix.md)
- [Documentation Structure](Documentation-Structure.md)
- [Conventions Tracking](Conventions-Tracking.md)
