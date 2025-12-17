# Conventions Tracking

This document tracks all conventions, patterns, rules, and methodologies detected during development work. It serves as a central registry ensuring no institutional knowledge is lost to conversation history.

## 🟡 Pending Documentation

### Detected: 2025-12-16

1. **No Underscore-Prefixed Unused Variables** (Rule)
   - **What**: Never use underscore-prefixed variables (`_event`, `_context`, `_metadata`) to suppress unused variable warnings
   - **Why**: Per AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused `_vars`"
   - **Solution**: Use object destructuring in function signatures to extract only needed properties
   - **Example**: `({event, context}: ApiHandlerParams)` instead of `(event, context, _metadata)`
   - **Detected**: During Lambda wrapper refactoring
   - **Target**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: CRITICAL
   - **Status**: Pending documentation
   - **Enforcement**: MCP config-enforcement rule validates eslint.config.mjs; CI runs validate:config

2. **Configuration Drift Detection** (Pattern)
   - **What**: MCP validation rules detect configuration changes that weaken project enforcement
   - **Why**: Configuration files can silently weaken enforcement standards (e.g., adding ignore patterns)
   - **Detected Patterns**: ESLint underscore ignore patterns, disabled TSConfig strict settings, excessive dprint line width
   - **Detected**: During MCP tooling expansion
   - **Target**: docs/wiki/Infrastructure/MCP-Validation-Rules.md
   - **Priority**: HIGH
   - **Status**: Pending documentation
   - **Enforcement**: CI validates on every push (unit-tests.yml)

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
   - **Exception**: Module-level constants that are directly imported by consumers (e.g., `defaultFile` in constants.ts) should remain module-level to prevent webpack tree-shaking. For these cases, tests should set env vars BEFORE importing the module rather than mocking env-validation.
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
   - **What**: Always use the `response` function from lambda-helpers for Lambda responses
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
- **Last Updated**: 2025-12-16
- **Total Conventions**: 29 detected, 27 documented, 2 pending
- **Convention Capture System**: Active
