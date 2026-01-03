# Conventions Tracking

Central registry of all project conventions with their documentation and enforcement mechanisms.

## Enforcement Summary

### Automated Methods

| Method | Count | Description |
|--------|-------|-------------|
| **MCP Rules** | 20 | AST-based validation via ts-morph |
| **ESLint** | 24 | Linting rules including 9 JSDoc rules + 2 Drizzle safety rules + 8 local rules + TSDoc |
| **Git Hooks** | 4 | Pre-commit, commit-msg, pre-push, post-checkout |
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
| doc-sync | docs | HIGH | [MCP Convention Tools](../MCP/Convention-Tools.md) |
| naming-conventions | naming | HIGH | [Naming Conventions](../Conventions/Naming-Conventions.md) |
| authenticated-handler-enforcement | auth | HIGH | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| comment-conventions | comments | HIGH | [Code Comments](../Conventions/Code-Comments.md) |
| docs-structure | docs-location | HIGH | [Documentation Structure](Documentation-Structure.md) |
| import-order | imports | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| response-enum | enum | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
| mock-formatting | mock | MEDIUM | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) |
| powertools-metrics | metrics | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |

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

### HIGH Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Integration Tests Use LocalStack | [LocalStack Testing](../Integration/LocalStack-Testing.md) | Code review + [Integration Test Audit](../Testing/Integration-Test-Audit.md) |
| Only Mock External Services in Integration Tests | [Coverage Philosophy](../Testing/Coverage-Philosophy.md) | Code review |
| Branch-First PR Workflow | [Git Workflow](../Conventions/Git-Workflow.md) | Git hook `pre-push` |
| Authenticated Handler Wrappers | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + ESLint |
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
| Aurora DSQL CREATE INDEX ASYNC | [Database Migrations](../Conventions/Database-Migrations.md) | Code review |

### MEDIUM Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Import Ordering | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| ResponseStatus Enum | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| Mock Return Formatting | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) | MCP |
| PowerTools Metrics | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| AWS SDK Mock Pattern | [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) | Code review |
| Lambda Directory Naming | [Naming Conventions](../Conventions/Naming-Conventions.md) | Code review |
| GraphRAG Synchronization | [GraphRAG Automation](../Infrastructure/GraphRAG-Automation.md) | GitHub Actions |

---

## Enforcement Improvement Opportunities

| Convention | Current | Proposed | Priority |
|------------|---------|----------|----------|
| ~~Migrations as Single Source of Truth~~ | ~~Code review~~ | ~~MCP rule: detect schema changes outside migrations~~ | ✅ Implemented |
| Aurora DSQL CREATE INDEX ASYNC | Code review | MCP rule: validate migration files | MEDIUM |
| AWS SDK Mock Pattern | Code review | ESLint rule extension | MEDIUM |
| Terraform Lambda Environment | Manual review | MCP rule for `merge(common_lambda_env, ...)` | MEDIUM |
| Template File Organization | Code review | MCP rule for embedded templates | LOW |

---

## Phase 3 Rules (Defined, Not Yet Enabled)

These ESLint rules are defined in `eslint-local-rules/` but not yet enabled in `eslint.config.mjs`:

| Rule | ESLint Name | Purpose | Blocker |
|------|-------------|---------|---------|
| PowerTools Enforcement | `local-rules/enforce-powertools` | Require Lambda handlers wrapped with PowerTools | Existing code migration needed |
| Domain Layer Purity | `local-rules/no-domain-leakage` | Prevent domain layer from importing outer layers | Need domain layer boundary definition |
| Strict Env Vars | `local-rules/strict-env-vars` | Forbid direct `process.env` in handlers | Migration to `getRequiredEnv()` needed |

**Activation Path**: Each rule requires migrating existing code to comply before enabling. Track migration progress via GitHub issues.

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
