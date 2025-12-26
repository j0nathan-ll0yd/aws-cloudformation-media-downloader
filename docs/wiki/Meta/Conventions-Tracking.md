# Conventions Tracking

Central registry of all project conventions with their documentation and enforcement mechanisms.

## Enforcement Summary

### Automated Methods

| Method | Count | Description |
|--------|-------|-------------|
| **MCP Rules** | 18 | AST-based validation via ts-morph |
| **ESLint** | 18 | Linting rules including 8 JSDoc rules |
| **Git Hooks** | 5 | Pre-commit, commit-msg, pre-push, post-checkout |
| **Dependency Cruiser** | 6 | Architectural boundary enforcement |
| **CI Workflows** | 3 | Script validation, type checking, GraphRAG sync |
| **Build-Time** | 1 | pnpm lifecycle script protection |

### MCP Validation Rules

| Rule | Alias | Severity | Documentation |
|------|-------|----------|---------------|
| aws-sdk-encapsulation | aws-sdk | CRITICAL | [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) |
| electrodb-mocking | electrodb | CRITICAL | [ElectroDB Testing Patterns](../Testing/ElectroDB-Testing-Patterns.md) |
| config-enforcement | config | CRITICAL | [MCP Convention Tools](../MCP/Convention-Tools.md) |
| env-validation | env | CRITICAL | [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) |
| cascade-safety | cascade | CRITICAL | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |
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
| mock-formatting | mock | MEDIUM | [Jest ESM Mocking Strategy](../Testing/Jest-ESM-Mocking-Strategy.md) |
| powertools-metrics | metrics | MEDIUM | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) |

---

## Convention Reference

### CRITICAL Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Zero AI References in Commits | [Git Workflow](../Conventions/Git-Workflow.md) | Git hook `commit-msg` |
| Vendor Library Encapsulation | [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) | MCP + ESLint + Dependency Cruiser |
| ElectroDB Test Mocking | [ElectroDB Testing Patterns](../Testing/ElectroDB-Testing-Patterns.md) | MCP + ESLint |
| No Try-Catch for Required Env Vars | [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) | MCP + ESLint |
| Cascade Deletion Order | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP + ESLint |
| pnpm Lifecycle Script Protection | [pnpm Migration](pnpm-Migration.md) | Build-time (.npmrc) |
| No Underscore-Prefixed Variables | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP `config-enforcement` |
| Use pnpm deploy, never tofu apply | [Drift Prevention](../Infrastructure/Drift-Prevention.md) | Script enforcement (pre-deploy-check.sh) |

### HIGH Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
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

### MEDIUM Severity

| Convention | Documentation | Enforcement |
|------------|---------------|-------------|
| Import Ordering | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| ResponseStatus Enum | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| Mock Return Formatting | [Jest ESM Mocking Strategy](../Testing/Jest-ESM-Mocking-Strategy.md) | MCP |
| PowerTools Metrics | [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) | MCP |
| Lambda Directory Naming | [Naming Conventions](../Conventions/Naming-Conventions.md) | Code review |
| GraphRAG Synchronization | [GraphRAG Automation](../Infrastructure/GraphRAG-Automation.md) | GitHub Actions |

---

## Enforcement Improvement Opportunities

| Convention | Current | Proposed | Priority |
|------------|---------|----------|----------|
| Terraform Lambda Environment | Manual review | MCP rule for `merge(common_lambda_env, ...)` | Medium |
| Template File Organization | Code review | MCP rule for embedded templates | Low |

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
