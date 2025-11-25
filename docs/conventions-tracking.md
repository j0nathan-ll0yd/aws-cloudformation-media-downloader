# Conventions Tracking

This document tracks all conventions, patterns, rules, and methodologies detected during development work. It serves as a central registry ensuring no institutional knowledge is lost to conversation history.

## 🟡 Pending Documentation

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

3. **GitHub Wiki Sync Automation** (Methodology)
   - **What**: Automated GitHub Actions workflow syncs docs/wiki/ to GitHub Wiki within 30 seconds of merge
   - **Why**: Best of both worlds - Git-tracked source with beautiful web UI, zero manual maintenance
   - **Detected**: During wiki organization strategy discussion
   - **Target**: docs/wiki/Meta/GitHub-Wiki-Sync.md
   - **Priority**: HIGH
   - **Status**: ⏳ Pending implementation

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

7. **Lambda Response Helper Usage** (Convention)
   - **What**: Always use the `response` function from lambda-helpers for Lambda responses, never return raw API Gateway response objects
   - **Why**: Ensures consistent response formatting and error handling across all Lambda functions
   - **Detected**: During Better Auth integration when reviewing RefreshToken Lambda
   - **Target**: docs/wiki/TypeScript/Lambda-Function-Patterns.md
   - **Priority**: HIGH
   - **Status**: ⏳ Pending wiki page update
   - **Example**: Use `return response(context, 200, data)` not `return {statusCode: 200, body: JSON.stringify(data)}`

8. **ElectroDB Test Mocking Standard** (Rule)
   - **What**: ALWAYS use the `createElectroDBEntityMock()` helper from test/helpers/electrodb-mock.ts for mocking ElectroDB entities in tests
   - **Why**: Ensures consistent mocking patterns, proper type safety, and simplified mock setup across all ElectroDB-related tests
   - **Detected**: During Better Auth test migration when fixing mock patterns
   - **Target**: docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md
   - **Priority**: CRITICAL
   - **Status**: ⏳ Pending wiki page update
   - **Example**: Use `const usersMock = createElectroDBEntityMock()` not manual mock creation
   - **Enforcement**: Zero-tolerance - all ElectroDB entity mocks must use this helper

## ✅ Recently Documented

_No entries yet - conventions will appear here after being documented in the wiki._

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
- **Last Updated**: 2025-11-25
- **Total Conventions**: 8 detected, 3 documented, 5 pending
- **Convention Capture System**: Active
