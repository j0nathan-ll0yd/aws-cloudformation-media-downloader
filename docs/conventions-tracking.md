# Conventions Tracking

This document tracks all conventions, patterns, rules, and methodologies detected during development work. It serves as a central registry ensuring no institutional knowledge is lost to conversation history.

## 📊 Enforcement Summary

### Automated Enforcement Methods

| Method | Count | Conventions |
|--------|-------|-------------|
| **MCP Rules** | 16 | aws-sdk-encapsulation, electrodb-mocking, config-enforcement, env-validation, cascade-safety, response-helpers, types-location, batch-retry, scan-pagination, import-order, response-enum, mock-formatting, doc-sync, naming-conventions, authenticated-handler-enforcement, convention-auto-fix |
| **ESLint** | 9 | no-direct-aws-sdk-import, cascade-delete-order, use-electrodb-mock-helper, response-helpers, env-validation, authenticated-handler-enforcement, enforce-powertools, no-domain-leakage, strict-env-vars |
| **Git Hooks** | 3 | AI attribution (commit-msg), direct master push (pre-push), dependency validation (pre-commit) |
| **Dependency Cruiser** | 6 | no-circular, no-cross-lambda-imports, no-direct-aws-sdk-import, no-entity-cross-dependencies, no-test-imports-in-production, no-orphans-lib |
| **CI Workflows** | 3 | script validation, type checking, GraphRAG auto-update |
| **Build-Time** | 1 | pnpm lifecycle script protection (.npmrc) |
| **Manual Review** | ~10 | code comments, test methodology, architectural patterns |

### MCP Validation Rules by Severity

| Rule | Alias | Severity | What It Checks |
|------|-------|----------|----------------|
| aws-sdk-encapsulation | aws-sdk | CRITICAL | Direct AWS SDK imports |
| electrodb-mocking | electrodb | CRITICAL | Manual entity mocks in tests |
| config-enforcement | config | CRITICAL | ESLint/TSConfig drift |
| env-validation | env | CRITICAL | Raw process.env access |
| cascade-safety | cascade | CRITICAL | Promise.all with deletes |
| response-helpers | response | HIGH | Raw response objects |
| types-location | types | HIGH | Types outside src/types/ |
| batch-retry | batch | HIGH | Unprotected batch ops |
| scan-pagination | scan | HIGH | Unpaginated scans |
| import-order | imports | MEDIUM | Import grouping order |
| response-enum | enum | MEDIUM | Magic status strings |
| mock-formatting | mock | MEDIUM | Chained mock returns |
| doc-sync | docs | HIGH | Documentation drift detection |
| naming-conventions | naming | HIGH | Type and enum naming patterns |
| authenticated-handler-enforcement | auth | HIGH | Manual auth checks in handlers |
| convention-auto-fix | auto-fix | MEDIUM | Apply conventions automatically |

---

## 🟡 Pending Documentation

### Detected: 2025-12-22

1. **TypeSpec-to-Runtime Code Generation** (Methodology)
   - **What**: Automated generation of Zod schemas and TypeScript types from TypeSpec API definitions
   - **Why**: TypeSpec becomes single source of truth; prevents API contract drift; ensures compile-time type safety
   - **Tool**: `pnpm gen:api-types` script using quicktype and custom Zod schema generation
   - **Output**: `src/types/api-schema/types.ts` and `src/types/api-schema/schemas.ts`
   - **Target**: docs/wiki/TypeScript/TypeSpec-Integration.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

2. **Test Scaffolding Tool** (DX Tool)
   - **What**: Automated test file generation with correct mock setup via `pnpm scaffold:test <file>`
   - **Why**: Reduces test writing time by 60%; ensures consistent mock patterns; follows project conventions
   - **Tool**: Uses ts-morph for AST analysis to detect imports and generate appropriate mocks
   - **Target**: docs/wiki/Testing/Test-Scaffolding.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

3. **PowerTools Wrapper Enforcement** (Rule)
   - **What**: All Lambda handlers must be wrapped with `withPowertools()` or `wrapLambdaInvokeHandler()`
   - **Why**: Consistent observability, error handling, and metrics across all Lambda functions
   - **Enforcement**: ESLint `local-rules/enforce-powertools` (HIGH severity)
   - **Target**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

4. **Domain Layer Purity** (Architecture Rule)
   - **What**: Files in `src/lib/domain/` cannot import from `src/lambdas/` or `src/lib/vendor/AWS/`
   - **Why**: Domain logic must remain pure and infrastructure-agnostic
   - **Enforcement**: ESLint `local-rules/no-domain-leakage` (HIGH severity)
   - **Target**: docs/wiki/Architecture/Domain-Layer.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

5. **Centralized Environment Variable Access** (Pattern)
   - **What**: Lambda handlers must use `getRequiredEnv()` instead of direct `process.env` access
   - **Why**: Fail-fast at cold start with clear error messages; centralized validation
   - **Enforcement**: ESLint `local-rules/strict-env-vars` (HIGH severity)
   - **Related**: Existing env-validation pattern, but now enforced via ESLint
   - **Target**: docs/wiki/AWS/Lambda-Environment-Variables.md (update existing)
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

6. **Pre-Commit Dependency Validation** (Workflow)
   - **What**: Dependency-cruiser runs automatically on `git commit` to catch architectural violations
   - **Why**: Shift-left validation prevents architectural drift from entering codebase
   - **Enforcement**: Husky pre-commit hook running `pnpm deps:check`
   - **Target**: docs/wiki/Conventions/Git-Workflow.md (update existing)
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

7. **No Orphaned Library Code** (Rule)
   - **What**: All modules in `src/lib/` must be imported by at least one file (except tests/types)
   - **Why**: Prevents dead code accumulation in shared library code
   - **Enforcement**: Dependency-cruiser `no-orphans-lib` rule (ERROR severity)
   - **Target**: docs/wiki/Architecture/Code-Organization.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation

8. **Automated GraphRAG Synchronization** (CI/CD)
   - **What**: GraphRAG knowledge graph automatically updates when source files change
   - **Why**: AI agents always have current semantic memory; documentation stays synchronized
   - **Triggers**: Changes to `src/lambdas/`, `src/entities/`, `src/lib/vendor/`, `graphrag/metadata.json`, `tsp/`
   - **Enforcement**: GitHub Actions workflow `.github/workflows/auto-update-graphrag.yml`
   - **Target**: docs/wiki/Infrastructure/GraphRAG-Automation.md
   - **Priority**: MEDIUM
   - **Status**: ✅ Implemented, pending documentation

9. **MCP Convention Auto-Fix** (Tool)
   - **What**: MCP server can automatically apply conventions (e.g., replace AWS SDK imports with vendor wrappers)
   - **Why**: Reduces manual refactoring effort; speeds up convention adherence
   - **Tool**: `apply_convention` MCP tool with support for multiple convention types
   - **Supported**: aws-sdk-wrapper (auto-fix), electrodb-mock (guidance), response-helper (guidance), env-validation (guidance), powertools (guidance)
   - **Target**: docs/wiki/MCP/Convention-Tools.md (update existing)
   - **Priority**: MEDIUM
   - **Status**: ✅ Implemented, pending documentation

_No pending conventions - all conventions are documented._

### Detected: 2025-12-23

1. **Workaround Tracking with Automated Monitoring** (Workflow Pattern)
   - **What**: When implementing workarounds for upstream dependency issues, create a tracking GitHub issue AND an automated workflow to monitor upstream status
   - **Why**: Prevents workarounds from becoming permanent technical debt; proactive notification when upstream fixes are available
   - **Components**:
     - GitHub Issue: Documents the workaround, links to upstream issue, explains impact
     - GitHub Actions Workflow: Weekly check of upstream issue status (`.github/workflows/check-upstream-issues.yml`)
     - Automated Comments: Posts to tracking issue when upstream is closed
   - **Example**: OTEL collector deprecation warning workaround → Issue #216 + check-upstream-issues.yml
   - **Template**: Add entries to `trackedIssues` array in workflow with `owner`, `repo`, `issue_number`, `our_issue`, `description`
   - **Target**: docs/wiki/Conventions/Workaround-Tracking.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation
   - **Enforcement**: Code review when adding workarounds

2. **Centralized Lambda Environment Configuration** (Infrastructure Pattern)
   - **What**: Use `common_lambda_env` Terraform local with `merge()` to centralize OTEL and runtime configuration
   - **Why**: DRY principle; ensures consistent configuration across all 14 lambdas; reduces ~90% log noise
   - **Variables**: `OTEL_LOG_LEVEL=warn`, `NODE_OPTIONS=--no-deprecation`, `OTEL_PROPAGATORS=xray`, `LOG_LEVEL=DEBUG`
   - **Pattern**: `environment { variables = merge(local.common_lambda_env, { OTEL_SERVICE_NAME = "LambdaName", ... }) }`
   - **Detected**: During log noise reduction implementation
   - **Target**: docs/wiki/AWS/X-Ray-Integration.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: Terraform/OpenTofu configuration

2. **Compact Request Logging** (Observability Pattern)
   - **What**: Use `getRequestSummary()` helper for INFO-level request logging (~150 bytes vs ~2.5KB)
   - **Why**: Reduces CloudWatch costs and log noise while maintaining debuggability
   - **Pattern**: `logInfo('request <=', getRequestSummary(event))` in middleware wrappers
   - **Details**: Extracts only path, method, requestId, sourceIp; full event available via DEBUG level or X-Ray
   - **Detected**: During log noise reduction implementation
   - **Target**: docs/wiki/AWS/CloudWatch-Logging.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: Middleware implementation

3. **skipMetrics for Non-Metric Lambdas** (Observability Pattern)
   - **What**: Pass `{skipMetrics: true}` to `withPowertools()` for lambdas that don't publish custom metrics
   - **Why**: Suppresses "No application metrics to publish" warnings from Powertools
   - **Example**: `export const handler = withPowertools(wrapAuthorizer(...), {skipMetrics: true})`
   - **Detected**: During log noise reduction implementation
   - **Target**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented
   - **Enforcement**: ESLint enforce-powertools rule

4. **External Template Files for Code Generation** (Code Organization Rule)
   - **What**: Code templates and fixtures must be stored in external `.template.txt` files, not embedded as string literals in source code
   - **Why**: Keeps generator code clean and maintainable; templates are easier to review, test, and modify independently; separates concerns between template content and interpolation logic
   - **Location**: `src/mcp/templates/` for MCP handlers; similar pattern for other generators
   - **Example**: `lines.push("const mock = ...")` is WRONG; `loadTemplate('test-scaffold/entity-mock.template.txt')` is CORRECT
   - **Loader**: Use `loadAndInterpolate()` from `src/mcp/templates/loader.ts` for simple placeholder replacement
   - **Detected**: During test-scaffold.ts refactoring
   - **Target**: docs/wiki/MCP/Template-Organization.md
   - **Priority**: HIGH
   - **Status**: ✅ Implemented, pending documentation
   - **Enforcement**: Code review; consider MCP validation rule

2. **CJS Dependency Compatibility** (Architectural Pattern)
   - **What**: Use `createRequire` shim in esbuild banner for CJS dependencies in ESM bundles
   - **Why**: Allows CJS packages (ElectroDB) to work in pure ESM Lambda environment without forking
   - **Shim**: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`
   - **Overhead**: ~200 bytes per bundle (negligible)
   - **Alternatives**: Dynamic imports for isolated usage, `import type` for types only, pnpm patches for built-in requires
   - **Detected**: During ElectroDB ESM compatibility investigation
   - **Target**: docs/wiki/TypeScript/ESM-Migration-Guide.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: Build-time (esbuild banner)

### Detected: 2025-12-22

1. **ESM Format Migration** (Architectural Pattern)
   - **What**: All Lambda functions now built as ESM (.mjs) targeting Node.js 24 (es2022)
   - **Why**: Performance improvements (cold starts, top-level await), future-proofing, better tree-shaking
   - **Build Config**: esbuild format: 'esm', target: 'es2022', outExtension: {'.js': '.mjs'}
   - **Infrastructure**: All terraform archive_file references updated to .mjs, runtime: nodejs24.x
   - **CJS Compatibility**: createRequire shim for ElectroDB, pnpm patch for jsonschema, dynamic imports for apns2
   - **Detected**: During comprehensive ESM migration implementation
   - **Target**: docs/wiki/TypeScript/ESM-Migration-Guide.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented

### Detected: 2025-12-20

1. **Branch-First PR Workflow** (Rule)
   - **What**: All feature work must follow strict flow: Create Branch -> Commit -> Push -> Create PR -> Wait for Review.
   - **Why**: Prevents direct commits to main, ensures code review, and maintains a clean history.
   - **Rule**: NEVER commit directly to main. ALWAYS wait for user approval on PRs.
   - **Target**: docs/wiki/Conventions/Git-Workflow.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance (Agent must self-correct).

### Detected: 2025-12-19

1. **Centralized Auth Handler Wrappers** (Security Pattern)
   - **What**: Use `wrapAuthenticatedHandler` for endpoints requiring authentication (rejects Unauthenticated + Anonymous) or `wrapOptionalAuthHandler` for endpoints allowing anonymous access (rejects only Unauthenticated)
   - **Why**: Eliminates boilerplate `getUserDetailsFromEvent()` + `UserStatus` checks; provides type-safe `userId` (guaranteed string in authenticated wrapper); fixes security vulnerabilities from missing auth checks
   - **Detected**: During security audit of Lambda handlers
   - **Target**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: MCP `authenticated-handler-enforcement` rule, ESLint `local-rules/authenticated-handler-enforcement`

### Detected: 2025-11-28

1. **Production Fixture Logging** (Testing Pattern)
   - **What**: Use `logIncomingFixture()` / `logOutgoingFixture()` to capture production API requests/responses for test fixture generation
   - **Why**: Transform testing from assumptions to production truth; CloudWatch extraction enables regular fixture updates
   - **Detected**: During fixture automation implementation
   - **Target**: docs/wiki/Testing/Fixture-Extraction.md
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented
   - **Enforcement**: Always enabled (logs to CloudWatch, extract when needed)

2. **ElectroDB Collections Testing** (Testing Pattern)
   - **What**: Test Collections (JOIN-like queries) with LocalStack to validate single-table design
   - **Why**: Ensures GSI queries work correctly across entity boundaries; validates userResources, fileUsers, deviceUsers, userSessions, userAccounts
   - **Detected**: During ElectroDB integration testing implementation
   - **Target**: docs/wiki/Testing/ElectroDB-Testing-Patterns.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: Required for Collections changes

### Detected: 2025-11-28 (Script Validation)

7. **Script Documentation Sync** (Rule)
   - **What**: All npm scripts referenced in `AGENTS.md` or `README.md` must exist in `package.json`
   - **Why**: Documentation drift causes confusion and broken developer workflows
   - **Detected**: During comprehensive repository review
   - **Target**: docs/wiki/Infrastructure/Script-Registry.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Enforcement**: CI validates on every push (unit-tests.yml)

### Detected: 2025-11-27

3. **No Try-Catch for Required Environment Variables** (Rule)
   - **What**: Never wrap required environment variable access in try-catch blocks with fallback values
   - **Why**: Infrastructure tests enforce that all required environment variables are properly configured; silent failures hide configuration errors
   - **Example**: `const config = JSON.parse(process.env.SignInWithAppleConfig)` NOT `try { const config = ... } catch { return fallback }`
   - **Detected**: During Better Auth configuration cleanup
   - **Documented**: docs/wiki/AWS/Lambda-Environment-Variables.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance (infrastructure tests verify all env vars are present)

### Detected: 2025-11-24

1. **pnpm Lifecycle Script Protection** (Security Rule)
   - **What**: All lifecycle scripts disabled by default in `.npmrc`; packages requiring scripts must be explicitly allowlisted after audit
   - **Why**: Defense against AI-targeted typosquatting and supply chain attacks that exploit LLM-assisted development
   - **Detected**: During npm to pnpm migration for security hardening
   - **Target**: Already documented in docs/wiki/Meta/pnpm-Migration.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance (all scripts blocked by default)

### Detected: 2025-11-22

1. **AGENTS.md Filename Standard** (Convention)
   - **What**: Use `AGENTS.md` (plural) as the filename for AI coding assistant context files
   - **Why**: Industry standard supported by OpenAI Codex, GitHub Copilot, Google Gemini, Cursor, and 20+ AI tools
   - **Detected**: During GitHub Wiki organization planning
   - **Documented**: docs/wiki/Meta/AI-Tool-Context-Files.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented

2. **Passthrough File Pattern** (Pattern)
   - **What**: Tool-specific files (CLAUDE.md, GEMINI.md) contain only a reference to the universal source (AGENTS.md)
   - **Why**: Maintains backwards compatibility while having single source of truth
   - **Detected**: During AI tool compatibility analysis
   - **Documented**: docs/wiki/Meta/AI-Tool-Context-Files.md
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented


4. **Zero AI References in Commits** (Rule)
   - **What**: Absolutely forbidden to include "Generated with Claude Code", "Co-Authored-By: Claude", emojis, or any AI references in commits/PRs
   - **Why**: Professional technical commits only, following commitlint syntax
   - **Detected**: Explicitly stated in CLAUDE.md project instructions
   - **Target**: Already documented in CLAUDE.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance

5. **AWS SDK Encapsulation Policy** (Rule)
   - **What**: NEVER import AWS SDK packages directly in application code; ALL usage must be wrapped in vendor modules (lib/vendor/AWS/)
   - **Why**: Encapsulation, type safety, testability, maintainability, consistency
   - **Detected**: Explicitly stated in CLAUDE.md project instructions
   - **Target**: Already documented in CLAUDE.md
   - **Priority**: CRITICAL
   - **Status**: ✅ Documented
   - **Enforcement**: Zero-tolerance

6. **Comprehensive Jest Mocking Strategy** (Methodology)
   - **What**: When importing ANY function from a module, must mock ALL of that module's transitive dependencies
   - **Why**: ES modules execute all module-level code on import; missing mocks cause obscure test failures
   - **Detected**: Explicitly stated in CLAUDE.md project instructions
   - **Target**: Already documented in CLAUDE.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented

### Detected: 2025-11-25



## ✅ Recently Documented

### Documented: 2025-12-22

1. **Centralized PII Sanitization** (Security Pattern)
   - **What**: All logging functions automatically sanitize PII via `sanitizeData()` utility in `util/security.ts`
   - **Why**: Prevents sensitive data leakage in CloudWatch logs
   - **Integration**: `logInfo()`, `logDebug()`, `logError()` in `util/logging.ts` automatically apply sanitization; test fixtures use same utility
   - **Patterns**: Redacts authorization, tokens, passwords, emails, names, phone numbers, SSN, credit cards, certificates (case-insensitive)
   - **Documented**: docs/wiki/TypeScript/PII-Protection.md
   - **Priority**: HIGH
   - **Enforcement**: Automatic in all logging functions

2. **TODO Comment Context Requirements** (Convention Clarification)
   - **What**: TODO comments must explain "why" with sufficient context, not just "what needs to be done"
   - **Why**: Aligns with "comments explain why, not what" principle; provides actionable information
   - **Examples**: Replace "TODO: Add alarm" with detailed explanation of what triggers alarm, why it's needed, and impact
   - **Documented**: docs/wiki/Conventions/Code-Comments.md (already documented, now enforced)
   - **Priority**: MEDIUM
   - **Enforcement**: Code review

### Documented: 2025-12-21

1. **No Deprecation - Remove Immediately** (Rule)
   - **What**: Remove deprecated code immediately instead of marking with `@deprecated` warnings
   - **Why**: Small project without external consumers; deprecation periods add noise and delay without benefit
   - **Rule**: When replacing a function/pattern, update ALL callers, tests, fixtures, and documentation in the same PR
   - **Example**: Replaced `lambdaErrorResponse()` with `buildApiResponse()` - removed old function entirely, no deprecation warning
   - **Documented**: docs/wiki/Conventions/Deprecation-Policy.md
   - **Priority**: HIGH
   - **Enforcement**: Code review; no `@deprecated` tags should be added

### Documented: 2025-12-19

1. **Lambda Types Directory Threshold** (Convention)
   - **What**: Create `types/` directory in a lambda only when 3+ types, types are re-exported, or types are complex (5+ properties)
   - **Why**: Reduces directory proliferation while maintaining organization for substantial type collections; small inline types are easier to understand next to their usage
   - **Rule**: Use inline types for 1-2 simple, non-exported types; use types/ directory for 3+ types or re-exported types
   - **Documented**: docs/wiki/TypeScript/Type-Definitions.md (Lambda-Specific Types section)
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented

### Documented: 2025-12-17

1. **Documentation Sync Validation** (Rule)
   - **What**: Automated validation ensures AGENTS.md, wiki, GraphRAG metadata, and MCP rules stay in sync with source code
   - **Why**: Prevents documentation drift that causes confusion for developers and AI assistants
   - **Enforcement**: CI validation via `pnpm run validate:doc-sync` and MCP `doc-sync` rule
   - **Checks**: Entity count, Lambda count, MCP rule count, path existence, stale patterns, GraphRAG metadata, wiki links
   - **Priority**: HIGH
   - **Status**: ✅ Documented
   - **Related Files**: bin/validate-doc-sync.sh, docs/doc-code-mapping.json, src/mcp/validation/rules/doc-sync.ts

### Documented: 2025-12-16

1. **Type Definitions Location** (Rule)
   - **What**: Exported type definitions (type aliases, interfaces, enums) must be in src/types/ directory
   - **Why**: Separation of concerns, discoverability, and maintainability
   - **Exceptions**: Entity-derived types (src/entities/), MCP types (src/mcp/), internal types
   - **Documented**: docs/wiki/TypeScript/Type-Definitions.md
   - **Priority**: HIGH
   - **Enforcement**: MCP `types-location` rule (HIGH severity); CI validates on push

2. **No Underscore-Prefixed Unused Variables** (Rule)
   - **What**: Never use underscore-prefixed variables (`_event`, `_context`, `_metadata`) to suppress unused variable warnings
   - **Why**: Per AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused `_vars`"
   - **Solution**: Use object destructuring in function signatures to extract only needed properties
   - **Documented**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: CRITICAL
   - **Enforcement**: MCP `config-enforcement` rule validates ESLint config; CI validates on push

3. **Configuration Drift Detection** (Pattern)
   - **What**: MCP validation rules detect configuration changes that weaken project enforcement
   - **Why**: Configuration files can silently weaken enforcement standards
   - **Detected Patterns**: ESLint underscore ignore patterns, disabled TSConfig strict settings
   - **Documented**: docs/wiki/MCP/Convention-Tools.md
   - **Priority**: HIGH
   - **Enforcement**: MCP `config-enforcement` rule; CI validates on every push

### Documented: 2025-11-29

1. **Multiline Array/Object Formatting Hint** (Convention)
   - **What**: Use `// fmt: multiline` comment after first element to force consistent multiline formatting
   - **Why**: dprint uses "best fit" algorithm that can create ugly mixed inline/multiline arrays; line comments cannot be collapsed to single line
   - **Documented**: docs/wiki/Conventions/Code-Formatting.md
   - **Priority**: MEDIUM
   - **Enforcement**: Optional (use when dprint's default formatting harms readability)

2. **Type Aliases for Line Width Management** (Convention)
   - **What**: Create type aliases for return types or parameter groups when function signatures exceed 157 characters
   - **Why**: Keeps function signatures on single lines for better readability; avoids awkward parameter wrapping
   - **Examples**: `SessionResult`, `RequestPayload`, `MetricInput`
   - **Documented**: docs/wiki/Conventions/Code-Formatting.md
   - **Priority**: MEDIUM
   - **Enforcement**: Optional (use when signatures would otherwise wrap)

3. **Sequential Mock Return Values as Separate Statements** (Convention)
   - **What**: Use separate statements instead of method chaining for `mockResolvedValueOnce` / `mockReturnValueOnce` sequences
   - **Why**: Chained methods exceed line width and wrap mid-chain; separate statements are dprint-stable and more readable
   - **Example**: `mockFn.mockResolvedValueOnce(a)` on line 1, `mockFn.mockResolvedValueOnce(b)` on line 2
   - **Documented**: docs/wiki/Conventions/Code-Formatting.md
   - **Priority**: MEDIUM
   - **Enforcement**: Always for sequences of 2+ mock return values

### Documented: 2025-11-28 (Code Quality Improvements)

1. **ResponseStatus Enum for API Responses** (Convention)
   - **What**: Use `ResponseStatus` enum for all API response status values instead of magic strings
   - **Why**: Type safety, consistency, and easier refactoring
   - **Documented**: src/types/enums.ts
   - **Priority**: MEDIUM
   - **Enforcement**: Prefer enum over string literals

2. **Environment Variable Validation** (Pattern)
   - **What**: Use `getRequiredEnv()` / `getRequiredEnvNumber()` from `util/env-validation.ts` for environment variables
   - **Why**: Fail fast at cold start with clear error messages instead of cryptic runtime failures
   - **Documented**: src/util/env-validation.ts
   - **Priority**: HIGH
   - **Enforcement**: Required for new Lambda functions

3. **Lazy Evaluation for Environment Variables** (Pattern)
   - **What**: Call `getRequiredEnv()` inside functions, not at module level
   - **Why**: Avoids test failures from env validation running at import time before mocks are set up
   - **Exception**: Module-level constants that are directly imported by consumers (e.g., `defaultFile` in constants.ts) should remain module-level to prevent esbuild tree-shaking. For these cases, tests should set env vars BEFORE importing the module rather than mocking env-validation.
   - **Example for functions**: `function getConfig() { return getRequiredEnv('Config') }` (lazy)
   - **Example for constants**: Set `process.env.DefaultFileUrl = 'value'` before import, NOT mock env-validation
   - **Documented**: src/util/constants.ts, src/lib/vendor/YouTube.ts
   - **Priority**: HIGH
   - **Enforcement**: Prefer lazy evaluation; use env vars in tests for module-level constants

4. **Batch Operation Retry Logic** (Pattern)
   - **What**: Use `retryUnprocessed()` / `retryUnprocessedDelete()` from `util/retry.ts` for DynamoDB batch operations
   - **Why**: DynamoDB batch operations may return unprocessed items; retry with exponential backoff prevents data loss
   - **Documented**: src/util/retry.ts
   - **Priority**: HIGH
   - **Enforcement**: Required for batch get/delete operations

5. **Paginated Scan Operations** (Pattern)
   - **What**: Use `scanAllPages()` from `util/pagination.ts` for DynamoDB scan operations
   - **Why**: DynamoDB scans are limited to 1MB per request; pagination prevents silent data truncation
   - **Documented**: src/util/pagination.ts
   - **Priority**: HIGH
   - **Enforcement**: Required for all scan operations

6. **Promise.allSettled for Cascade Operations** (Pattern)
   - **What**: Use `Promise.allSettled()` instead of `Promise.all()` for cascade deletion and multi-resource operations
   - **Why**: Prevents partial state from orphaning data; allows handling individual failures gracefully
   - **Documented**: src/lambdas/UserDelete/src/index.ts, src/lambdas/PruneDevices/src/index.ts
   - **Priority**: HIGH
   - **Enforcement**: Required for cascade operations

7. **Cascade Deletion Order** (Rule)
   - **What**: Delete child entities BEFORE parent entities in cascade operations
   - **Why**: Prevents orphaned references if parent deletion succeeds but child deletion fails
   - **Documented**: src/lambdas/UserDelete/src/index.ts
   - **Priority**: CRITICAL
   - **Enforcement**: Zero-tolerance for incorrect cascade order

### Documented: 2025-11-28

1. **ElectroDB Test Mocking Standard** (Rule)
   - **What**: ALWAYS use the `createElectroDBEntityMock()` helper for mocking ElectroDB entities
   - **Why**: Ensures consistent mocking patterns and proper type safety
   - **Documented**: docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md
   - **Priority**: CRITICAL
   - **Enforcement**: Zero-tolerance

3. **Lambda Response Helper Usage** (Convention)
   - **What**: Always use the `buildApiResponse` function from lambda-helpers for Lambda responses
   - **Why**: Ensures consistent response formatting across all Lambda functions
   - **Documented**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: HIGH

4. **GitHub Wiki Sync Automation** (Methodology)
   - **What**: Automated GitHub Actions workflow syncs docs/wiki/ to GitHub Wiki
   - **Why**: Git-tracked source with beautiful web UI, zero manual maintenance
   - **Documented**: docs/wiki/Meta/GitHub-Wiki-Sync.md
   - **Priority**: HIGH

5. **Dependency Graph Analysis** (Methodology)
   - **What**: Use build/graph.json to identify all transitive dependencies for Jest mocking
   - **Why**: ES modules execute all module-level code, requiring comprehensive mocking
   - **Documented**: docs/wiki/Testing/Dependency-Graph-Analysis.md (NEW)
   - **Priority**: HIGH

6. **Lambda Directory Naming** (Convention)
   - **What**: Lambda function directories use PascalCase to match AWS resource naming
   - **Why**: Easy correlation between code and infrastructure
   - **Documented**: docs/wiki/Conventions/Naming-Conventions.md
   - **Priority**: MEDIUM

## 💭 Proposed Conventions

### Device ID Tracking in Auth Flows

**What**: Login and Registration requests should include deviceId in request payload
**Why**: Better Auth session tracking includes deviceId for device-specific session management
**Current Status**: deviceId is always `undefined` in LoginUser and RegisterUser Lambdas
**Implementation Note**: iOS app needs to be updated to send deviceId in auth requests
**Code References**:
- LoginUser: `src/lambdas/LoginUser/src/index.ts:77`
- RegisterUser: `src/lambdas/RegisterUser/src/index.ts:161`

_Note: This is not blocking functionality but would improve session tracking capabilities._

## 🗄️ Archived Conventions

_No archived conventions yet - superseded or deprecated conventions will be moved here._

---

## Usage Guidelines

### For AI Assistants

When working on this project:
1. **Start of Session**: Review this file to understand current conventions
2. **During Session**: Flag new conventions immediately when detected
3. **End of Session**: Update this file with newly detected conventions
4. **Before Documenting**: Move convention from "Pending" to "Recently Documented"

### For Developers

When contributing:
1. Review pending conventions to understand emerging patterns
2. Provide feedback on proposed conventions
3. Help document conventions in the wiki
4. Update this file when conventions are officially documented

### Convention Lifecycle

```
Detected → Pending Documentation → Documented in Wiki → Recently Documented → (after 30 days) → Archived
                                                                                              ↓
                                                                                      Superseded/Deprecated
```

## Metadata

- **Created**: 2025-11-22
- **Last Updated**: 2025-12-23
- **Total Conventions**: 43 detected (32 documented, 11 pending documentation)
- **Convention Capture System**: Active
