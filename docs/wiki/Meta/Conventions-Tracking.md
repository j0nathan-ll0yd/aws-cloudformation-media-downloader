# Conventions Tracking

Central registry of all project conventions with their documentation and enforcement mechanisms.

## Architecture Decision Records

ADRs capture the "why" behind conventions. See [docs/wiki/Decisions/](../Decisions/README.md) for full list.

| ADR | Title | Related Conventions | Enforcement |
|-----|-------|---------------------|-------------|
| [0001](../Decisions/0001-adr-adoption.md) | ADR Adoption | - | - |
| [0002](../Decisions/0002-vendor-encapsulation.md) | Vendor Encapsulation | Vendor Encapsulation Policy | MCP, ESLint, Dep Cruiser |
| [0003](../Decisions/0003-testing-philosophy.md) | Testing Philosophy | Coverage Philosophy | Code review |
| [0004](../Decisions/0004-lazy-initialization.md) | Lazy Initialization | Lambda Function Patterns | MCP `env-validation` |
| [0005](../Decisions/0005-drift-prevention.md) | Drift Prevention | Drift Prevention | Script enforcement |
| [0006](../Decisions/0006-lambda-middleware.md) | Lambda Middleware | Lambda Function Patterns | ESLint `enforce-powertools` |
| [0007](../Decisions/0007-error-handling-types.md) | Error Handling | TypeScript Error Handling | Code review |
| [0008](../Decisions/0008-database-migration.md) | Database Migration | Database Migrations | MigrateDSQL Lambda |
| [0009](../Decisions/0009-pii-sanitization.md) | PII Sanitization | PII Protection | Built into logging |
| [0010](../Decisions/0010-no-ai-attribution.md) | No AI Attribution | Git Workflow | Git hook `commit-msg` |
| [0011](../Decisions/0011-type-organization.md) | Type Organization | Type Definitions | MCP `types-location` |
| [0012](../Decisions/0012-remocal-testing.md) | Remocal Testing | LocalStack Testing | Test scripts |

---

## Enforcement Summary

### Automated Methods

| Method | Count | Description |
|--------|-------|-------------|
| **MCP Rules** | 28 | AST-based validation via ts-morph |
| **ESLint** | 26 | Linting rules including 9 JSDoc rules + 2 Drizzle safety rules + 10 local rules + TSDoc |
| **Git Hooks** | 5 | Pre-commit (deps + secrets), commit-msg, pre-push, post-checkout |
| **Dependency Cruiser** | 8 | Architectural boundary enforcement |
| **CI Workflows** | 4 | Script validation, type checking, GraphRAG sync, security audit |
| **Dependabot** | 2 | npm + GitHub Actions ecosystem updates |
| **Build-Time** | 1 | pnpm lifecycle script protection |

### MCP Validation Rules

| Rule | Alias | Severity | Documentation |
|------|-------|----------|---------------|
| aws-sdk-encapsulation | aws-sdk | CRITICAL | [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) |
| drizzle-orm-encapsulation | drizzle | CRITICAL | [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) |
| entity-mocking | entity | CRITICAL | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) |
| config-enforcement | config | CRITICAL | [MCP Convention Tools](../MCP/Convention-Tools.md) |
| env-validation | env | CRITICAL | [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) |
| cascade-safety | cascade | CRITICAL | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| migrations-safety | migrations | CRITICAL | [Database Migrations](../Conventions/Database-Migrations.md) |
| response-helpers | response | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| types-location | types | HIGH | [Type Definitions](../TypeScript/Type-Definitions.md) |
| batch-retry | batch | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| scan-pagination | scan | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| aurora-dsql-async-index | async-index | HIGH | [Database Migrations](../Conventions/Database-Migrations.md) |
| doc-sync | docs | HIGH | [MCP Convention Tools](../MCP/Convention-Tools.md) |
| naming-conventions | naming | HIGH | [Naming Conventions](../Conventions/Naming-Conventions.md) |
| authenticated-handler-enforcement | auth | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| database-permissions | database, db-permissions | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| secret-permissions | secrets | HIGH | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) |
| service-permissions | services | HIGH | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) |
| eventbridge-permissions | eventbridge, events | HIGH | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) |
| comment-conventions | comments | HIGH | [Code Comments](../Conventions/Code-Comments.md) |
| docs-structure | docs-location | HIGH | [Documentation Structure](Documentation-Structure.md) |
| import-order | imports | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| response-enum | enum | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| mock-formatting | mock | MEDIUM | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) |
| powertools-metrics | metrics | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| logging-conventions | logging | MEDIUM | [Logging Conventions](../Conventions/Logging-Conventions.md) |

---

## Convention Reference

### CRITICAL Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Zero AI References in Commits | [Git Workflow](../Conventions/Git-Workflow.md) | Git hook `commit-msg` |
| Vendor Library Encapsulation | [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) | MCP + ESLint + Dependency Cruiser |
| Entity Query Mocking | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) | MCP + ESLint |
| No Try-Catch for Required Env Vars | [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) | MCP + ESLint |
| Cascade Deletion Order | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + ESLint |
| Drizzle Delete Requires Where | [Drizzle Patterns](../TypeScript/Drizzle-Patterns.md) | ESLint `drizzle/enforce-delete-with-where` |
| Drizzle Update Requires Where | [Drizzle Patterns](../TypeScript/Drizzle-Patterns.md) | ESLint `drizzle/enforce-update-with-where` |
| Migrations as Single Source of Truth | [Database Migrations](../Conventions/Database-Migrations.md) | MCP + ESLint |
| pnpm Supply Chain Security | [Dependency Security](../Security/Dependency-Security.md) | pnpm-workspace.yaml + .npmrc |
| No Underscore-Prefixed Variables | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP `config-enforcement` |
| Use pnpm deploy, never tofu apply | [Drift Prevention](../Infrastructure/Drift-Prevention.md) | Script enforcement (pre-deploy-check.sh) |
| Security Audit in CI | [Dependabot Resolution](../Methodologies/Dependabot-Resolution.md) | GitHub Actions + Dependabot |
| All Secrets Encrypted with SOPS | [Secret-Rotation-Runbook](../Security/Secret-Rotation-Runbook.md) | .gitignore + pre-commit hook |
| Never Commit secrets.yaml | [Secret-Rotation-Runbook](../Security/Secret-Rotation-Runbook.md) | .gitignore + pre-commit hook |

### HIGH Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Integration Tests Use LocalStack | [LocalStack Testing](../Testing/LocalStack-Testing.md) | ESLint `integration-test-localstack` |
| Only Mock External Services in Integration Tests | [Coverage Philosophy](../Testing/Coverage-Philosophy.md) | Code review |
| Branch-First PR Workflow | [Git Workflow](../Conventions/Git-Workflow.md) | Git hook `pre-push` |
| Authenticated Handler Wrappers | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + ESLint |
| Database Permissions Decorator | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + Build Scripts |
| Secret Permissions Decorator | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) | MCP |
| Service Permissions Decorator | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) | MCP |
| EventBridge Permissions Decorator | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) | MCP |
| Vendor Wrapper Method Decorators | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md#aws-service-method-decorators) | Build Scripts |
| Entity Query Method Decorators | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md#entity-query-method-decorator) | Build Scripts |
| Powertools Method Decorators | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md#dynamodbpowertools-method-decorator) | Build Scripts |
| Lambda Response Helper | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + ESLint |
| Type Definitions Location | [Type Definitions](../TypeScript/Type-Definitions.md) | MCP |
| Batch Operation Retry | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| Paginated Scan Operations | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| PowerTools Wrapper | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | ESLint |
| Domain Layer Purity | [Domain Layer](../Architecture/Domain-Layer.md) | ESLint + Dependency Cruiser |
| No Orphaned Library Code | [Code Organization](../Architecture/Code-Organization.md) | Dependency Cruiser |
| Environment Variable Access | [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) | MCP + ESLint |
| Documentation Structure | [Documentation Structure](Documentation-Structure.md) | MCP + pre-commit hook |
| Comment Conventions | [Code Comments](../Conventions/Code-Comments.md) | ESLint + MCP |
| External Template Files | [Template Organization](../MCP/Template-Organization.md) | Code review |
| Workaround Tracking | [Workaround Tracking](../Conventions/Workaround-Tracking.md) | GitHub Actions |
| ManagedBy Tag on All Resources | [Drift Prevention](../Infrastructure/Drift-Prevention.md) | Audit script (aws-audit.sh) |
| Post-Deploy State Verification | [Drift Prevention](../Infrastructure/Drift-Prevention.md) | Manual (`pnpm run state:verify`) |
| Database Migrations via SQL Files | [Database Migrations](../Conventions/Database-Migrations.md) | MigrateDSQL Lambda + Terraform |
| Aurora DSQL CREATE INDEX ASYNC | [Database Migrations](../Conventions/Database-Migrations.md) | MCP `aurora-dsql-async-index` |
| Lambda Layer Binary Version Tracking | [Lambda Layers](../Infrastructure/Lambda-Layers.md) | Terraform + Code review |
| Use getRequiredEnv() for Secret Access | [Secret-Rotation-Runbook](../Security/Secret-Rotation-Runbook.md) | ESLint `local-rules/env-validation` |

### MEDIUM Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Import Ordering | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| ResponseStatus Enum | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| Mock Return Formatting | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) | MCP |
| PowerTools Metrics | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| AWS SDK Mock Pattern | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) | ESLint `aws-sdk-mock-pattern` |
| Lambda Directory Naming | [Naming Conventions](../Conventions/Naming-Conventions.md) | Code review |
| camelCase TypeScript File Naming | [Naming Conventions](../Conventions/Naming-Conventions.md) | Code review + MCP |
| Vendor Class `*Vendor` Naming | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md#function-level-permission-decorators) | Build Scripts |
| Bound Method Re-exports | [Lambda Decorators](../Infrastructure/Lambda-Decorators.md#function-level-permission-decorators) | Code review |
| Logging Message Conventions | [Logging Conventions](../Conventions/Logging-Conventions.md) | MCP `logging-conventions` |
| GraphRAG Synchronization | [GraphRAG Automation](../Infrastructure/GraphRAG-Automation.md) | GitHub Actions |
| YouTube Cookie Rotation (30-60 days) | [Secret-Rotation-Runbook](../Security/Secret-Rotation-Runbook.md) | Auto-detection via 403 errors |
| Document Secret Expiration Dates | [Secret-Rotation-Runbook](../Security/Secret-Rotation-Runbook.md) | Manual (runbook) |

---

## Enforcement Improvement Opportunities

| Convention | Current | Proposed | Priority |
|------------|---------|----------|----------|
| ~~Migrations as Single Source of Truth~~ | ~~Code review~~ | ~~MCP rule: detect schema changes outside migrations~~ | ✅ Implemented |
| ~~Aurora DSQL CREATE INDEX ASYNC~~ | ~~Code review~~ | ~~MCP rule: validate migration files~~ | ✅ Implemented |
| ~~AWS SDK Mock Pattern~~ | ~~Code review~~ | ~~ESLint rule extension~~ | ✅ Implemented |
| Terraform Lambda Environment | Manual review | MCP rule for `merge(common_lambda_env, ...)` | MEDIUM |
| Template File Organization | Code review | MCP rule for embedded templates | LOW |

---

## Phase 3 Rules (Defined, Selectively Enabled)

These ESLint rules are defined in `eslint-local-rules/`:

| Rule | ESLint Name | Purpose | Status |
|------|-------------|---------|--------|
| PowerTools Enforcement | `local-rules/enforce-powertools` | Require Lambda handlers wrapped with PowerTools | ✅ Enabled (excludes Lambda@Edge) |
| Domain Layer Purity | `local-rules/no-domain-leakage` | Prevent domain layer from importing outer layers | ✅ Enabled (AWS SDK files moved to services layer) |
| Strict Env Vars | `local-rules/strict-env-vars` | Forbid direct `process.env` in handlers | ✅ Enabled (excludes test files) |

**Notes**:
- PowerTools Enforcement excludes `CloudfrontMiddleware` (Lambda@Edge has bundle size constraints)
- Domain Layer Purity: AWS SDK-dependent services moved from `src/lib/domain/` to `src/lib/services/`
- Strict Env Vars excludes test files that need to set `process.env` for test setup

---

## Proposed Conventions

### Device ID Tracking in Auth Flows

**Status**: Proposed (not blocking)

iOS app should send deviceId in auth requests for Better Auth session tracking.

**References**:
- `src/lambdas/LoginUser/src/index.ts:77`
- `src/lambdas/RegisterUser/src/index.ts:161`

---

## Usage

**For AI Assistants**: Review this file at session start. When detecting new conventions, add them to the appropriate severity section with documentation link and enforcement mechanism.

**For Developers**: Use this as a quick reference for what's enforced and how. Detailed guidance is in the linked documentation pages.

---

*Convention details live in wiki pages. This file tracks enforcement mechanisms.*
