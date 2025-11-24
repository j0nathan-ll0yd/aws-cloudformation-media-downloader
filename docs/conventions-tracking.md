# Conventions Tracking

This document tracks all conventions, patterns, rules, and methodologies detected during development work. It serves as a central registry ensuring no institutional knowledge is lost to conversation history.

## 🟡 Pending Documentation

### Detected: 2025-11-24

1. **Production Fixture Extraction** (Methodology)
   - **What**: Automated capture of production API requests/responses from CloudWatch logs for test fixtures
   - **Why**: Tests reflect real-world usage patterns, not assumptions; captures edge cases automatically
   - **Detected**: During fixture automation implementation
   - **Target**: docs/wiki/Testing/Fixture-Extraction.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented

2. **ElectroDB Integration Testing Patterns** (Methodology)
   - **What**: Comprehensive patterns for testing ElectroDB entities and Collections with LocalStack
   - **Why**: Single-table design with JOIN-like queries requires specific testing approach; validates GSI configurations
   - **Detected**: During fixture automation implementation
   - **Target**: docs/wiki/Testing/ElectroDB-Testing-Patterns.md
   - **Priority**: HIGH
   - **Status**: ✅ Documented

3. **Fixture Logging Functions** (Pattern)
   - **What**: `logIncomingFixture()` and `logOutgoingFixture()` functions in lambda-helpers.ts for marking production data
   - **Why**: Enables automated fixture extraction from CloudWatch; PII sanitization built-in
   - **Detected**: During fixture automation implementation
   - **Target**: Already documented in lambda-helpers.ts with JSDoc
   - **Priority**: MEDIUM
   - **Status**: ✅ Documented

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

## ✅ Recently Documented

_No entries yet - conventions will appear here after being documented in the wiki._

## 💭 Proposed Conventions

_No proposals yet - use this section for conventions under discussion that haven't been adopted._

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
- **Last Updated**: 2025-11-22
- **Total Conventions**: 6 detected, 3 documented, 3 pending
- **Convention Capture System**: Active
