# Conventions Tracking

This document tracks all conventions, patterns, rules, and methodologies detected during development work. It serves as a central registry ensuring no institutional knowledge is lost to conversation history.

## 🟡 Pending Documentation

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

### Detected: 2025-11-27

3. **No Try-Catch for Required Environment Variables** (Rule)
   - **What**: Never wrap required environment variable access in try-catch blocks with fallback values
   - **Why**: Infrastructure tests enforce that all required environment variables are properly configured; silent failures hide configuration errors
   - **Example**: `const config = JSON.parse(process.env.SignInWithAppleConfig)` NOT `try { const config = ... } catch { return fallback }`
   - **Detected**: During Better Auth configuration cleanup
   - **Target**: docs/wiki/Conventions/Environment-Variables.md
   - **Priority**: CRITICAL
   - **Status**: ⏳ Pending documentation
   - **Enforcement**: Infrastructure tests verify all env vars are present

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
   - **Target**: docs/wiki/Meta/AI-Tool-Context-Files.md
   - **Priority**: HIGH
   - **Status**: ⏳ Pending wiki page creation

2. **Passthrough File Pattern** (Pattern)
   - **What**: Tool-specific files (CLAUDE.md, GEMINI.md) contain only a reference to the universal source (AGENTS.md)
   - **Why**: Maintains backwards compatibility while having single source of truth
   - **Detected**: During AI tool compatibility analysis
   - **Target**: docs/wiki/Meta/AI-Tool-Context-Files.md
   - **Priority**: MEDIUM
   - **Status**: ⏳ Pending wiki page creation


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

### Documented: 2025-11-28

1. **No Try-Catch for Required Environment Variables** (Rule)
   - **What**: Never wrap required environment variable access in try-catch blocks with fallback values
   - **Why**: Infrastructure tests enforce that all required environment variables are properly configured
   - **Documented**: docs/wiki/AWS/Lambda-Environment-Variables.md
   - **Priority**: CRITICAL
   - **Enforcement**: Zero-tolerance

2. **ElectroDB Test Mocking Standard** (Rule)
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
- **Last Updated**: 2025-11-28
- **Total Conventions**: 16 detected, 11 documented, 5 pending
- **Convention Capture System**: Active
