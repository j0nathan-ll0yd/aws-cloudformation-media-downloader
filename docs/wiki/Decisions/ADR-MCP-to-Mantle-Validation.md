# ADR: Migration from Custom MCP Validation to Mantle CLI Check System

## Status
Accepted

## Date
2026-03-26

## Context

This project previously maintained a custom Model Context Protocol (MCP) server at `src/mcp/` with an AST-based convention validation engine built on ts-morph. The validation system contained 29 rule files (plus tests), a runner, type definitions, and four supporting scripts. During the Mantle framework migration (commit `aac7726d`), the entire `src/mcp/` directory (209 files) was removed as part of the source restructuring.

The project now depends on `@mantleframework/cli` which provides `mantle check` -- a built-in convention validation system that replaces much of the custom MCP validation with framework-aware rules.

This ADR documents what was lost, what was gained, and what action to take on the orphaned scripts.

## Old System: Custom MCP Validation

### Architecture

- **Engine**: ts-morph AST analysis (`src/mcp/validation/index.ts`)
- **Rule interface**: Each rule implemented `ValidationRule` with `name`, `description`, `severity`, `appliesTo` (glob patterns), `excludes`, and a `validate(sourceFile, filePath)` method returning `Violation[]`
- **Runner**: `validateFile()` / `validateFiles()` functions that loaded a ts-morph `Project`, matched rules to files via glob patterns, and aggregated results
- **Output**: `ValidationResult` per file with `violations`, `passed`, and `skipped` arrays, plus `getValidationSummary()` for aggregate reporting

### Rules (29 total: 7 CRITICAL, 17 HIGH, 5 MEDIUM)

#### CRITICAL (7)
| Rule | What it enforced |
|------|------------------|
| `aws-sdk-encapsulation` | No direct `@aws-sdk/*` imports; use vendor wrappers |
| `drizzle-orm-encapsulation` | No direct Drizzle ORM imports; use entity layer |
| `entity-mocking` | Tests must mock `#entities/queries`, not legacy paths |
| `config-enforcement` | Config file conventions (underscore vars, ESLint settings) |
| `env-validation` | Use `getRequiredEnv()`/`getOptionalEnv()`, never raw `process.env` |
| `cascade-safety` | No `Promise.all` for cascade deletions; sequential order required |
| `migrations-safety` | Migrations as single source of truth; no inline schema changes |

#### HIGH (17)
| Rule | What it enforced |
|------|------------------|
| `response-helpers` | Use `response()` helper, not raw `{statusCode, body}` |
| `types-location` | Types in `src/types/`, not scattered in Lambda dirs |
| `batch-retry` | Batch operations must handle partial failures with retry |
| `scan-pagination` | DynamoDB scans must handle pagination |
| `aurora-dsql-async-index` | `CREATE INDEX` in migrations must use `ASYNC` for DSQL |
| `doc-sync` | Documentation references match actual file paths |
| `naming-conventions` | PascalCase classes, camelCase files, naming patterns |
| `authenticated-handler-enforcement` | API handlers must use authenticated wrapper |
| `comment-conventions` | Exported functions require JSDoc comments |
| `docs-structure` | Wiki files in correct directories |
| `secret-permissions` | Lambda uses secrets => must have `@RequiresSecret` decorator |
| `service-permissions` | Lambda calls services => must have `@RequiresService` decorator |
| `eventbridge-permissions` | Lambda publishes events => must have `@RequiresEventBridge` decorator |
| `vendor-decorator-coverage` | Vendor wrapper methods must have permission decorators |
| `permission-gap-detection` | Cross-reference vendor imports against permissions manifest |
| `wiki-link-validation` | Wiki markdown links resolve to actual files |
| `cicd-conventions` | GitHub Actions workflow conventions (YAML-based, not AST) |

#### MEDIUM (5)
| Rule | What it enforced |
|------|------------------|
| `import-order` | Import statement ordering (node, external, internal) |
| `response-enum` | Use `ResponseStatus` enum, not string literals |
| `mock-formatting` | Test mock return values follow consistent format |
| `powertools-metrics` | Lambda handlers wrapped with PowerTools metrics |
| `logging-conventions` | Structured logging message format conventions |

### Supporting Scripts (4)
| Script | Purpose | npm command |
|--------|---------|-------------|
| `scripts/validateConventions.ts` | Run all MCP rules against `src/**/*.ts` | `validate:conventions` |
| `scripts/validateConfig.ts` | Run `config-enforcement` rule against config files | `validate:config` |
| `scripts/generateConventionDashboard.ts` | Generate coverage dashboard from all enforcement tools | `dashboard:conventions` |
| `scripts/reportEnforcementGaps.ts` | Compare documented conventions against actual enforcement | `report:gaps` |

## New System: Mantle CLI `mantle check`

### Architecture

- **Engine**: Built into `@mantleframework/cli` -- understands Mantle conventions natively (filesystem routing, `define*Handler()` patterns, `@mantleframework/*` imports)
- **Invocation**: `mantle check [--severity LEVEL] [--rule NAME] [--fast]`
- **Subcommands**: Specialized checkers beyond convention rules

### Convention Rules (12 rules: 1 CRITICAL, 5 HIGH, 6 MEDIUM)

| Rule | Severity | What it enforces |
|------|----------|------------------|
| `no-raw-process-env` | CRITICAL | Use `@mantleframework/env` helpers, not `process.env` |
| `define-lambda-required` | HIGH | All Lambda handlers must call `define*Handler()` or `defineLambda()` |
| `handler-export` | HIGH | Lambda handlers must use framework handler functions |
| `entity-decorators` | HIGH | Entity query methods need `@RequiresTable` decorators |
| `observability-coverage` | HIGH | Handlers must have observability via `define*Handler()` |
| `require-schema-validation` | HIGH | API handlers must use `querySchema`/`bodySchema`, not manual access |
| `comment-conventions` | MEDIUM | Exported functions require JSDoc comments |
| `handler-size-limit` | MEDIUM | Handlers should be ~60 lines max; extract to services |
| `naming-conventions` | MEDIUM | Query classes should end with `Queries` |
| `no-barrel-exports` | MEDIUM | No barrel `index.ts` re-exports; Mantle uses filesystem discovery |
| `powertools-metrics` | MEDIUM | Handlers must use metrics middleware |
| `pure-transform-functions` | MEDIUM | Large inline object literals should be extracted to pure functions |

### Specialized Subcommands (5)

| Subcommand | What it does |
|------------|--------------|
| `mantle check deps` | Dependency architecture boundary enforcement |
| `mantle check env-vars` | Cross-references Lambda env vars in infrastructure vs source code |
| `mantle check bundles` | Lambda bundle size threshold checks (requires build) |
| `mantle check dead-code` | Unused exports and dead code detection via knip |
| `mantle check ci-workflows` | GitHub Actions YAML consistency (permissive patterns, etc.) |

## Gap Analysis

### Fully Covered by Mantle CLI

These old MCP rules have direct equivalents (same or better) in `mantle check`:

| Old MCP Rule | Mantle Equivalent | Notes |
|--------------|-------------------|-------|
| `env-validation` | `no-raw-process-env` | Same check, updated for `@mantleframework/env` |
| `comment-conventions` | `comment-conventions` | Same rule |
| `naming-conventions` | `naming-conventions` | Narrower scope (query class suffixes) |
| `powertools-metrics` | `powertools-metrics` | Updated for `define*Handler()` pattern |
| `cicd-conventions` | `ci-workflows` subcommand | More comprehensive YAML analysis |
| `authenticated-handler-enforcement` | `handler-export` + `define-lambda-required` | Subsumed by mandatory `define*Handler()` |
| `response-helpers` | `handler-export` | `define*Handler()` returns typed responses natively |

### New in Mantle CLI (no MCP equivalent)

| Mantle Rule | Value |
|-------------|-------|
| `define-lambda-required` | Enforces framework handler pattern universally |
| `handler-size-limit` | Architectural quality -- keeps handlers thin |
| `no-barrel-exports` | Prevents stale barrel files with filesystem routing |
| `require-schema-validation` | Type-safe request parsing via Zod schemas |
| `entity-decorators` | Permission tracing via `@RequiresTable` |
| `observability-coverage` | Built-in metrics/tracing/logging via handler wrappers |
| `pure-transform-functions` | Encourages testable pure function extraction |
| `deps` subcommand | Dependency architecture enforcement |
| `env-vars` subcommand | Infrastructure-to-source env var reconciliation |
| `bundles` subcommand | Bundle size monitoring |
| `dead-code` subcommand | Unused export detection (knip) |

### Lost (no Mantle equivalent)

These old MCP rules have no replacement in `mantle check`. Some are covered by other tools (ESLint, Dependency Cruiser); others are gaps.

| Old MCP Rule | Severity | Covered Elsewhere? | Risk |
|--------------|----------|--------------------|------|
| `aws-sdk-encapsulation` | CRITICAL | ESLint `no-direct-aws-sdk-import` + Dependency Cruiser | Low -- still enforced |
| `drizzle-orm-encapsulation` | CRITICAL | ESLint `drizzle/enforce-delete-with-where` (partial) | Medium -- import boundary not checked |
| `entity-mocking` | CRITICAL | ESLint (partial) | Medium -- legacy mock patterns could slip in |
| `config-enforcement` | CRITICAL | None | Low -- config rarely changes; code review sufficient |
| `cascade-safety` | CRITICAL | ESLint rule (if still present) | Medium -- `Promise.all` on cascades is dangerous |
| `migrations-safety` | CRITICAL | MigrateDSQL Lambda enforces at runtime | Low -- runtime guard exists |
| `aurora-dsql-async-index` | HIGH | None | Low -- infrequent migration writes |
| `types-location` | HIGH | None | Low -- architectural; code review catches this |
| `batch-retry` | HIGH | None | Medium -- partial failures silently lost |
| `scan-pagination` | HIGH | None | Low -- no DynamoDB after Aurora DSQL migration |
| `doc-sync` | HIGH | None | Low -- documentation drift is cosmetic |
| `docs-structure` | HIGH | None | Low -- wiki structure is stable |
| `secret-permissions` | HIGH | None (decorators removed in Mantle migration) | N/A -- decorator system replaced |
| `service-permissions` | HIGH | None (decorators removed) | N/A -- replaced by `entity-decorators` |
| `eventbridge-permissions` | HIGH | None (decorators removed) | N/A -- replaced by Mantle permission model |
| `vendor-decorator-coverage` | HIGH | None (decorators removed) | N/A -- architecture changed |
| `permission-gap-detection` | HIGH | None (decorators removed) | N/A -- architecture changed |
| `wiki-link-validation` | HIGH | None | Low -- broken links are cosmetic |
| `import-order` | MEDIUM | ESLint import ordering rules | Low -- style only |
| `response-enum` | MEDIUM | None | Low -- `define*Handler()` handles responses |
| `mock-formatting` | MEDIUM | None | Low -- test style preference |
| `logging-conventions` | MEDIUM | None | Low -- `@mantleframework/observability` structures logging |

### Summary

| Category | Count |
|----------|-------|
| Old MCP rules | 29 |
| Fully replaced by Mantle | 7 |
| No longer applicable (architecture changed) | 5 |
| Covered by other tools (ESLint, Dep Cruiser) | 4 |
| True gaps (no automated enforcement) | 13 |
| New rules only in Mantle | 12 (7 rules + 5 subcommands) |

Of the 13 true gaps, most are LOW risk due to the Mantle architecture changes (for example, `define*Handler()` eliminates the need for `response-helpers` and `response-enum`; Aurora DSQL migration eliminated DynamoDB scan pagination concerns). The two MEDIUM-risk gaps are `cascade-safety` and `batch-retry`, which guard against data loss patterns.

## Decision

### 1. Adopt `mantle check` as the primary convention validation system

Replace `pnpm run validate:conventions` with `mantle check --severity MEDIUM` in CI and pre-commit workflows.

### 2. Remove dead scripts

The following scripts import from `src/mcp/validation/` which no longer exists. They fail at runtime. Remove them and their `package.json` entries:

| Script | npm command | Replacement |
|--------|-------------|-------------|
| `scripts/validateConventions.ts` | `validate:conventions` | `mantle check --severity MEDIUM` |
| `scripts/validateConfig.ts` | `validate:config` | `mantle check --rule define-lambda-required` (partial); remainder by code review |
| `scripts/generateConventionDashboard.ts` | `dashboard:conventions` | No replacement needed; `mantle check` output is the dashboard |
| `scripts/reportEnforcementGaps.ts` | `report:gaps` | This ADR serves as the gap analysis; no recurring script needed |

### 3. Accept low-risk gaps

The 13 rules without Mantle equivalents are acceptable losses because:
- 5 are N/A (decorator system was replaced by Mantle's architecture)
- 4 are covered by ESLint or other tools
- The remaining gaps are LOW risk (documentation quality, test style, infrequent operations)

### 4. Monitor medium-risk gaps

Watch for regressions in:
- **Cascade safety**: `Promise.all` on sequential deletions (consider adding an ESLint rule)
- **Batch retry**: Partial failure handling in batch operations (consider adding an ESLint rule)

## Consequences

### Positive
- Eliminates 209 files of custom validation infrastructure and ts-morph dependency
- `mantle check` understands the framework natively (handler patterns, filesystem routing, observability)
- New checks that the old system lacked (handler size limits, schema validation, dead code, bundle sizes, env var reconciliation)
- Single tool invocation replaces 4 separate scripts
- Rules automatically evolve with framework updates via `@mantleframework/cli` upgrades

### Negative
- Loss of 13 custom rules without automated replacement (mostly low risk)
- `mantle check` has fewer total convention rules (12 vs 29) -- breadth traded for depth
- Dashboard and gap-reporting capabilities lost (cosmetic tooling)
- `Conventions-Tracking.md` references to "MCP rules" are now stale and need updating

## Enforcement

| Method | Scope |
|--------|-------|
| `mantle check --severity MEDIUM` | All 12 convention rules + 5 subcommands |
| `mantle check --fast` | CRITICAL rules only (CI fast path) |
| `mantle check --rule <name>` | Single rule execution |
| ESLint local rules | Vendor encapsulation, env vars, integration tests |
| Dependency Cruiser | Cross-module architectural boundaries |
| Code review | Cascade safety, batch retry, documentation quality |

## Related

- [Conventions Tracking](../Meta/Conventions-Tracking.md) -- central registry (needs update to reflect Mantle migration)
- [ADR-0002: Vendor Encapsulation](0002-vendor-encapsulation.md) -- `aws-sdk-encapsulation` now ESLint-only
- [ADR-0004: Lazy Initialization](0004-lazy-initialization.md) -- `env-validation` now `no-raw-process-env`
- [ADR-0006: Lambda Middleware](0006-lambda-middleware.md) -- superseded by `define*Handler()` pattern
- Commit `aac7726d` -- source restructuring that removed `src/mcp/`
