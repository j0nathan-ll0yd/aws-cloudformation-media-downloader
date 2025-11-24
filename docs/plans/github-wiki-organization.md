# GitHub Wiki Organization Strategy

## Executive Summary

This document outlines the strategy for transforming the GitHub Wiki into the central reference point for all reusable development conventions, principles, and methodologies. The goal is to extract ~70% of documentation that represents universal patterns into a centralized Wiki, reducing project-specific documentation from 855 to approximately 200 lines while improving maintainability and reusability across multiple projects.

## AI Tool Compatibility Strategy

### AGENTS.md: The Industry Standard

**Decision**: Use AGENTS.md (plural) as the single source of truth for AI coding assistant context.

**Rationale**: AGENTS.md is the open standard maintained collaboratively by OpenAI, Amp, Google, Cursor, and Factory, with support across 20+ AI coding tools.

#### Tool Support Matrix

| AI Tool | Auto-Reads AGENTS.md | Auto-Reads CLAUDE.md | Auto-Reads GEMINI.md | Notes |
|---------|---------------------|---------------------|---------------------|-------|
| **OpenAI Codex CLI** | ✅ Yes | No | No | `/init` creates AGENTS.md |
| **GitHub Copilot** | ✅ Yes | ✅ Yes | ✅ Yes | Reads all, nearest precedence |
| **Google Gemini CLI** | Configurable | No | ✅ Yes | Default: GEMINI.md |
| **Google Gemini IDE** | ✅ Yes | No | ✅ Yes | Native support |
| **Claude Code** | No | ✅ Yes | No | Only CLAUDE.md |
| **Cursor** | ✅ Yes | - | - | Full codebase indexing |
| **Codeium** | ✅ Yes | - | - | Full codebase indexing |
| **Aider** | ✅ Yes | - | - | Native support |
| **Devin** | ✅ Yes | - | - | Native support |

#### Passthrough Strategy

To maintain compatibility with all tools, use a passthrough pattern:

```
AGENTS.md          (390 lines - canonical source)
CLAUDE.md          (1 line - @AGENTS.md)
GEMINI.md          (4 lines - points to AGENTS.md)
```

**Benefits**:
- Single source of truth eliminates duplication
- Claude Code compatibility maintained via passthrough
- Gemini Code Assist compatibility maintained
- Full support for OpenAI Codex, GitHub Copilot, and 18+ other tools
- Future-proof as new tools adopt AGENTS.md standard

#### Universal Convention Persistence via AGENTS.md

**The Architecture**:

```
Universal Layer (AGENTS.md)
├─ Convention Capture System instructions
├─ Universal patterns and methodologies
├─ Links to wiki for detailed conventions
└─ Applies to ALL user projects

Project-Specific Layer (CLAUDE.md - passthrough)
├─ @AGENTS.md reference (inherits universal system)
├─ Project-specific overrides/additions
└─ Local conventions tracking (docs/conventions-tracking.md)
```

**How Convention Capture Becomes Universal**:

1. **AGENTS.md Contains Core Instructions**:
   - How to detect conventions (signals, priorities)
   - How to track conventions (docs/conventions-tracking.md pattern)
   - How to generate session summaries
   - Links to this wiki as reference implementation

2. **Project-Specific CLAUDE.md**:
   - References AGENTS.md via passthrough: `@AGENTS.md`
   - Inherits Convention Capture System automatically
   - Can add project-specific conventions

3. **Wiki as Reference Implementation**:
   - This wiki documents the Convention Capture System methodology
   - Serves as template for other projects
   - Contains Meta/ section with the complete system documentation

4. **Persistence Across Projects**:
   - AI reads AGENTS.md at start of every session (any project)
   - AGENTS.md instructs AI to use Convention Capture System
   - Each project has its own docs/conventions-tracking.md
   - Universal methodology, project-specific conventions

**Why This Works**:

- ✅ **Every project** that uses AGENTS.md gets Convention Capture automatically
- ✅ **No duplication** - Convention Capture System defined once in AGENTS.md
- ✅ **Project autonomy** - Each project tracks its own conventions
- ✅ **Universal methodology** - Same system across all work
- ✅ **AI persistence** - AI remembers to use system by reading AGENTS.md

**What Goes Where**:

| Content | Location | Scope |
|---------|----------|-------|
| Convention detection patterns | AGENTS.md | Universal (all projects) |
| System instructions | AGENTS.md | Universal (all projects) |
| Methodology documentation | docs/wiki/Meta/ | Reference implementation |
| Project conventions | docs/conventions-tracking.md | Project-specific |
| Session summaries | docs/sessions/ | Project-specific |

**Example AGENTS.md Structure**:

```markdown
# AI Agent Instructions

## Convention Capture System

**CRITICAL**: Use the Convention Capture System to preserve institutional memory.

### At Start of Session:
1. Read `docs/conventions-tracking.md` (if exists)
2. Activate convention detection mode

### During Work:
Monitor for signals:
- 🚨 CRITICAL: "NEVER", "FORBIDDEN", "Zero-tolerance"
- ⚠️ HIGH: "MUST", "REQUIRED", "ALWAYS", corrections
- 📋 MEDIUM: "Prefer", repeated decisions
- 💡 LOW: Suggestions

### Flag Convention Format:
```
🔔 **CONVENTION DETECTED**
[Details]
Document now? [Y/N]
```

### At End of Session:
1. Generate session summary
2. Update docs/conventions-tracking.md
3. List pending documentation

### Reference Implementation:
See [Convention Capture System Guide](https://github.com/user/project/wiki/Meta/Convention-Capture-System) for complete methodology.

## [Project-Specific Content Below]
...
```

**Migration Path for Existing Projects**:

1. Create AGENTS.md with Convention Capture instructions
2. Create docs/conventions-tracking.md (empty or with known conventions)
3. Project-specific CLAUDE.md becomes: `@AGENTS.md`
4. Start new session → AI automatically uses Convention Capture System
5. Over time, project builds its own convention database

**This Creates True Persistence**:
- Convention Capture methodology lives in AGENTS.md (universal)
- Every project using AGENTS.md gets it automatically
- No need to re-explain the system in each project
- AI assistants become "convention-aware" across all your work

#### Current Duplication Problem

The repository currently has:
- **CLAUDE.md**: 390 lines
- **GEMINI.md**: 390 lines
- **Duplication**: 95% identical content

This creates maintenance burden where every documentation update requires changes to multiple files.

#### AGENTS.md Standard Specification

- **Format**: Standard Markdown, no rigid schema
- **Flexibility**: Use any headings, organization preferred
- **Monorepo Support**: Nested AGENTS.md files, closest one takes precedence
- **Typical Sections**: Project overview, build commands, code style, testing, security, commit guidelines
- **Official Resource**: https://agents.md

## Wiki Storage Strategy

### Recommendation: Git-Based Wiki (docs/wiki/)

**Store Wiki content in the main repository** under `docs/wiki/` rather than using GitHub's separate Wiki feature.

#### Rationale

**Advantages of Git-Based Storage:**
- ✅ **Version Control**: Wiki changes tracked alongside code changes
- ✅ **Atomic Updates**: Code + documentation changes in same commit/PR
- ✅ **Offline Access**: Wiki available without network connection
- ✅ **IDE Integration**: Edit in VS Code with full tooling support
- ✅ **Review Process**: Wiki changes go through PR review
- ✅ **Search**: Works with repository search and grep
- ✅ **Automation**: Can lint, validate links, run checks in CI
- ✅ **References**: Easy to link from code comments and AGENTS.md
- ✅ **Single Source**: No sync issues between Wiki and repo

**GitHub Wiki Limitations:**
- ❌ Separate git repository (requires separate clone)
- ❌ Changes not in same PR as related code
- ❌ Can drift out of sync with codebase
- ❌ Limited CI/CD integration
- ❌ Harder to enforce documentation standards

#### Implementation

**Directory Structure:**
```
docs/
├── wiki/                           # Git-based wiki content
│   ├── Home.md
│   ├── Getting-Started.md
│   ├── Conventions/
│   │   ├── Naming-Conventions.md
│   │   ├── Git-Workflow.md
│   │   └── ...
│   ├── TypeScript/
│   ├── Testing/
│   ├── AWS/
│   ├── Bash/
│   ├── Infrastructure/
│   └── Methodologies/
├── plans/                          # Implementation plans
├── styleGuides/                    # Language-specific guides
└── ...
```

**Reference Pattern:**
From AGENTS.md or style guides:
```markdown
See [Wiki: Naming Conventions](docs/wiki/Conventions/Naming-Conventions.md)
```

**GitHub Wiki Sync (REQUIRED):**

**This is a mandatory component** - automatically sync `docs/wiki/` to GitHub Wiki using GitHub Actions for zero-maintenance publication.

**Architecture**:
```
docs/wiki/ (Git)  →  GitHub Actions  →  GitHub Wiki (Public View)
  Source of Truth      Auto-sync on       Beautiful UI
  PR reviewed          push to master     Search enabled
```

**Why required**: Without automated sync, the wiki becomes a manual maintenance burden that will inevitably fall out of date. Automated sync ensures developers edit in Git (with full IDE support) while users get a beautiful, searchable web interface that's always current.

**Implementation**: See [GitHub Wiki Sync Strategy](#github-wiki-sync-strategy) section below for complete automation setup (Phase 4, Week 4).

This approach treats `docs/wiki/` as the source of truth while automatically providing GitHub Wiki as a public-facing view.

## Current Documentation Analysis

### Documentation Metrics

| File | Current Lines | Reusable Content | Project-Specific |
|------|--------------|------------------|------------------|
| CLAUDE.md | 855 | ~70% (600 lines) | ~30% (255 lines) |
| GEMINI.md | 390 | Mostly duplicates | Minimal unique |
| Style Guides (5 files) | 2,328 | ~80% universal | ~20% examples |
| **Total** | **3,573** | **~2,500 lines** | **~1,073 lines** |

### Key Findings

1. **High Duplication**: CLAUDE.md and GEMINI.md share 85% of content
2. **Universal Patterns**: Most conventions apply to ANY TypeScript/AWS project
3. **Cross-References**: Style guides reference each other frequently
4. **Zero-Tolerance Rules**: Critical patterns repeated in multiple places
5. **Enforcement Gaps**: Some rules documented but not easily discoverable

## Proposed Wiki Architecture

### Top-Level Structure

```
docs/wiki/                               # Git-tracked wiki content
├── Home.md                              # Index, quick start, navigation
├── Getting-Started.md                   # How to use the Wiki
│
├── Conventions/
│   ├── Naming-Conventions.md            # camelCase, PascalCase, etc.
│   ├── Git-Workflow.md                  # Commit messages, no AI attribution
│   ├── Code-Comments.md                 # Git as source of truth
│   └── Import-Organization.md           # ES modules, destructuring
│
├── TypeScript/
│   ├── Lambda-Function-Patterns.md      # Handler organization
│   ├── Error-Handling.md                # API Gateway vs event-driven
│   ├── Type-Definitions.md              # Where to put types
│   └── Module-Best-Practices.md         # Export patterns
│
├── Testing/
│   ├── Jest-ESM-Mocking-Strategy.md     # Transitive dependencies
│   ├── Mock-Type-Annotations.md         # Specific vs generic types
│   ├── Lazy-Initialization-Pattern.md   # Defer SDK clients
│   ├── Coverage-Philosophy.md           # Test YOUR code
│   └── Integration-Testing.md           # LocalStack patterns
│
├── AWS/
│   ├── SDK-Encapsulation-Policy.md      # Vendor wrapper pattern
│   ├── Lambda-Environment-Variables.md  # Naming conventions
│   ├── CloudWatch-Logging.md            # Logging patterns
│   └── X-Ray-Integration.md             # Tracing patterns
│
├── Bash/
│   ├── Variable-Naming.md               # snake_case vs UPPER_CASE
│   ├── Directory-Resolution.md          # BASH_SOURCE patterns
│   ├── User-Output-Formatting.md        # Colors and feedback
│   └── Error-Handling.md                # set -e, exit codes
│
├── Infrastructure/
│   ├── Resource-Naming.md               # PascalCase for AWS
│   ├── File-Organization.md             # Service grouping
│   └── Environment-Variables.md         # Cross-stack consistency
│
├── Methodologies/
│   ├── Convention-Over-Configuration.md # Core philosophy
│   ├── Library-Migration-Checklist.md   # Step-by-step process
│   ├── Dependabot-Resolution.md         # Automated updates
│   └── Production-Debugging.md          # Troubleshooting guide
│
└── Meta/
    ├── Working-with-AI-Assistants.md    # Effective AI collaboration
    ├── Convention-Capture-System.md     # This system (meta!)
    ├── Emerging-Conventions.md          # Live append-only log
    ├── AI-Tool-Context-Files.md         # AGENTS.md, CLAUDE.md standards
    └── Documentation-Patterns.md        # Passthrough files, organization
```

### Page Content Structure

Each Wiki page will follow this template:

```markdown
# [Pattern Name]

## Quick Reference
- **When to use**: [One-line description]
- **Enforcement**: [How it's checked]
- **Impact if violated**: [High/Medium/Low]

## The Rule
[Clear, concise statement of the convention]

## Examples
### ✅ Correct
[Code example]

### ❌ Incorrect
[Anti-pattern example]

## Rationale
[Why this pattern exists]

## Enforcement
[How to check/enforce this pattern]

## Exceptions
[When this pattern doesn't apply]

## Related Patterns
[Links to other Wiki pages]
```

## Content Migration Plan

### Phase 1: Core Conventions (Week 1)

#### Pages to Create

1. **Naming-Conventions.md**
   - Source: CLAUDE.md lines 112-140
   - Content: camelCase, PascalCase, SCREAMING_SNAKE_CASE rules
   - Priority: HIGH - Referenced everywhere

2. **Git-Workflow.md**
   - Source: CLAUDE.md lines 79-102, 237-268
   - Content: No AI attribution, commit verification, no auto-push
   - Priority: CRITICAL - Zero-tolerance rule

3. **Code-Comments.md**
   - Source: CLAUDE.md line 110, multiple style guides
   - Content: Git as source of truth, no removed code explanations
   - Priority: HIGH - Prevents documentation rot

4. **Import-Organization.md**
   - Source: lambdaStyleGuide.md lines 94-130
   - Content: Import order, destructuring patterns
   - Priority: MEDIUM - Code consistency

#### Actions
- Create Wiki skeleton with all categories
- Write initial 4 core convention pages
- Add navigation structure to Home.md
- Test cross-references between pages

### Phase 2: Testing Patterns (Week 2)

#### Pages to Create

1. **Jest-ESM-Mocking-Strategy.md**
   - Source: CLAUDE.md lines 269-454, testStyleGuide.md lines 145-192
   - Content: Transitive dependency solution, 7-step checklist
   - Priority: CRITICAL - Solves obscure test failures

2. **Mock-Type-Annotations.md**
   - Source: testStyleGuide.md lines 194-263
   - Content: When to use specific vs generic types
   - Priority: HIGH - Type safety in tests

3. **Lazy-Initialization-Pattern.md**
   - Source: testStyleGuide.md lines 145-192
   - Content: Defer SDK client creation for X-Ray
   - Priority: MEDIUM - Specific but valuable

4. **Coverage-Philosophy.md**
   - Source: testStyleGuide.md lines 7-76
   - Content: Test YOUR code, not library code
   - Priority: HIGH - Testing philosophy

#### Actions
- Extract complex mocking patterns with examples
- Create flowchart for transitive dependency resolution
- Add troubleshooting section for common errors
- Link to integration testing patterns

### Phase 3: AWS Patterns (Week 3)

#### Pages to Create

1. **SDK-Encapsulation-Policy.md**
   - Source: CLAUDE.md lines 143-224, lambdaStyleGuide.md lines 7-53
   - Content: Vendor wrapper pattern, zero-tolerance enforcement
   - Priority: CRITICAL - Architectural pattern

2. **Lambda-Environment-Variables.md**
   - Source: lambdaStyleGuide.md lines 130-172
   - Content: CamelCase for module-level constants
   - Priority: MEDIUM - Consistency

3. **CloudWatch-Logging.md**
   - Source: lambdaStyleGuide.md lines 369-418
   - Content: logDebug, logInfo, logError patterns
   - Priority: MEDIUM - Observability

4. **X-Ray-Integration.md**
   - Source: Multiple references in CLAUDE.md
   - Content: Decorator pattern, conditional usage
   - Priority: LOW - Optional feature

#### Actions
- Create architecture diagram for SDK encapsulation
- Add code generation templates for vendor wrappers
- Include enforcement scripts (grep patterns)
- Document migration path for existing code

### Phase 4: GitHub Wiki Sync Setup (Week 4)

#### Objective
Implement automated, zero-maintenance sync from docs/wiki/ to GitHub Wiki.

#### Actions

1. **Enable GitHub Wiki**:
   - Go to repository Settings → Features → Enable Wikis
   - Verify wiki is accessible at github.com/user/repo/wiki

2. **Create GitHub Actions Workflow**:
   - Create `.github/workflows/sync-wiki.yml`
   - Configure to trigger on docs/wiki/ changes
   - Set up manual trigger option

3. **Create Sync Scripts**:
   - Create `.github/scripts/sync-wiki.sh` (main sync logic)
   - Create `.github/scripts/generate-sidebar.sh` (navigation generator)
   - Make scripts executable: `chmod +x .github/scripts/*.sh`

4. **Create Initial Wiki Pages**:
   - Create `docs/wiki/Home.md` with welcome content
   - Create `docs/wiki/Getting-Started.md` with wiki usage guide
   - Include link to main repository

5. **Test Sync Workflow**:
   - Push changes to master
   - Watch GitHub Actions workflow run
   - Verify wiki appears correctly
   - Test all links work
   - Verify sidebar navigation
   - Test search functionality

6. **Validate Edge Cases**:
   - Test file deletion (should remove from wiki)
   - Test file rename (should show as delete + add)
   - Test broken links (should be caught by CI)
   - Test large changes (should sync smoothly)

**Success Criteria**:
- ✅ Wiki syncs automatically within 30 seconds of merge
- ✅ All links work in wiki format
- ✅ Sidebar navigation auto-generated
- ✅ Footer includes source attribution
- ✅ Zero manual maintenance required

**Estimated Effort**: 1-2 hours

### Phase 5: Project Simplification (Week 4-5)

#### Create New Templates

1. **AGENTS.md Template** (Single Source of Truth for All AI Tools):

```markdown
# Project Context for AI Agents

## Convention Capture System

**CRITICAL**: This project uses an automated system to capture emergent conventions during development. This ensures institutional memory persists across sessions and projects.

### At Start of EVERY Session:
1. Read `docs/conventions-tracking.md` to understand current project conventions
2. Review universal detection patterns (see below)
3. Activate convention detection mode

### During Work - Monitor for Signals:
- 🚨 **CRITICAL**: "NEVER", "FORBIDDEN", "Zero-tolerance"
- ⚠️ **HIGH**: "MUST", "REQUIRED", "ALWAYS", corrections like "Actually, it's X not Y"
- 📋 **MEDIUM**: "Prefer X over Y", repeated decisions (2+ times)
- 💡 **LOW**: Suggestions to monitor

### Flag Convention Format:
```
🔔 **CONVENTION DETECTED**

**Name**: [Convention Name]
**Type**: [Rule/Pattern/Methodology/Convention]
**What**: [One-sentence description]
**Why**: [Brief rationale]
**Priority**: [Critical/High/Medium/Low]

Document now? [Y/N]
```

### At End of Session:
1. Generate session summary using template: `docs/templates/session-summary-template.md`
2. Save to: `docs/sessions/YYYY-MM-DD-topic.md`
3. Update `docs/conventions-tracking.md` with newly detected conventions
4. List pending documentation tasks

### Reference Implementation:
- **System Guide**: `docs/CONVENTION-CAPTURE-GUIDE.md` - Complete methodology
- **Detection Patterns**: `docs/convention-detection-patterns.md` - Signal reference
- **Templates**: `docs/templates/` - Convention & session summary templates
- **Wiki**: `docs/wiki/Meta/Convention-Capture-System.md` - Public documentation

**Key Principle**: Better to flag and dismiss than miss a convention. Zero conventions lost to conversation history.

---

## Project Overview
AWS Serverless media downloader with iOS companion app.
- **Architecture**: Lambda, S3, API Gateway, DynamoDB
- **Language**: TypeScript (Node.js 22.x)
- **Infrastructure**: OpenTofu
- **Purpose**: Offline media playback alternative to YouTube Premium

## Project Structure
[Directory layout - 20 lines]

## Critical Project-Specific Rules
1. Read build/graph.json for file relationships
2. Feedly webhook uses query-based auth
3. APNS requires platform configuration
4. YouTube downloads need cookie authentication

## Wiki Conventions to Follow
**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**
- Lambda code: [Lambda Function Patterns](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- Testing: [Jest ESM Mocking Strategy](docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md)
- AWS patterns: [SDK Encapsulation Policy](docs/wiki/AWS/SDK-Encapsulation-Policy.md)
- Bash scripts: [Variable Naming](docs/wiki/Bash/Variable-Naming.md)
- Git workflow: [Git Workflow](docs/wiki/Conventions/Git-Workflow.md) (NO AI ATTRIBUTION)

## Development Workflow
- Build: `npm run build`
- Test: `npm test`
- Deploy: `npm run deploy`
- Format: `npm run format`
[Complete commands - 40 lines]

## Integration Points
- Feedly: Webhook for article processing
- YouTube: yt-dlp for downloads
- APNS: iOS push notifications
- Sign In With Apple: Authentication
[Details - 30 lines]

## Common Tasks
- Adding new Lambda: [checklist]
- Updating API endpoints: [checklist]
- Debugging production: [checklist]
[Task checklists - 60 lines]

Total: ~275 lines (includes Convention Capture System)
```

2. **Simplified Style Guide Template**:

```markdown
# [Language] Style Guide - [Project Name]

## Wiki Standards Applied
This project follows these Wiki conventions:
- [Naming Conventions](../wiki/Conventions/Naming-Conventions.md)
- [Git Workflow](../wiki/Conventions/Git-Workflow.md)
- [Language-Specific Pattern](../wiki/[Category]/[Page].md)

## Project-Specific Patterns
[Only patterns unique to this project]

## Project-Specific Examples
[Code examples using project's actual code]

## Local Deviations
[Any cases where project differs from Wiki standards]
```

3. **Tool-Specific Passthrough Files**:

**CLAUDE.md** (Claude Code compatibility):
```markdown
@AGENTS.md
```

**GEMINI.md** (Gemini Code Assist compatibility):
```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see [AGENTS.md](./AGENTS.md) for comprehensive project documentation and guidelines.
```

These passthrough files maintain compatibility with tools that look for specific filenames while AGENTS.md serves as the canonical source supported by OpenAI Codex, GitHub Copilot, Cursor, and 20+ other tools.

#### Actions
- Create AGENTS.md from template (~200 lines of project-specific content)
- Create CLAUDE.md passthrough file (1 line: `@AGENTS.md`)
- Create GEMINI.md passthrough file (4 lines pointing to AGENTS.md)
- Update all 5 style guides to reference docs/wiki/ paths
- Update README.md to reference new structure

**Rationale**:
- **AGENTS.md** is the industry-standard format supported by OpenAI Codex, GitHub Copilot, Google Gemini, Cursor, and 20+ other tools
- **CLAUDE.md** passthrough maintains Claude Code auto-loading compatibility
- **GEMINI.md** passthrough maintains Gemini Code Assist compatibility
- This eliminates the current duplication between CLAUDE.md and GEMINI.md (both 390 lines, 95% identical)

## Content Classification

### Wiki-Ready Content (Centralize)

| Category | Content | Reusability |
|----------|---------|-------------|
| **Conventions** | Naming, Git workflow, comments | Universal |
| **Testing** | Jest ESM mocking, type annotations | Universal |
| **AWS Patterns** | SDK encapsulation, vendor wrappers | AWS projects |
| **TypeScript** | Lambda patterns, error handling | TS projects |
| **Bash** | Variable naming, error handling | Shell scripts |
| **Methodologies** | Convention over configuration | Universal |

### Project-Specific Content (Keep Local)

| Category | Content | Reason |
|----------|---------|--------|
| **Architecture** | Service topology, data flow | Unique design |
| **Lambda Functions** | Specific handler purposes | Business logic |
| **API Endpoints** | Routes, payloads, auth | Application-specific |
| **Integrations** | Feedly, YouTube, APNS | Third-party specific |
| **Deployment** | OpenTofu commands, AWS accounts | Environment-specific |
| **Secrets** | SOPS configuration, keys | Security-sensitive |

## Implementation Strategy

### Step 1: Wiki Infrastructure Setup
1. Create all category folders in Wiki
2. Add Home.md with navigation structure
3. Create Getting-Started.md for Wiki usage
4. Set up page template for consistency

### Step 2: Content Extraction & Migration
1. Start with highest-priority patterns
2. Extract content preserving examples
3. Add cross-references between pages
4. Verify all code examples work

### Step 3: Project Documentation Update (Transform CLAUDE.md → AGENTS.md)

**CRITICAL**: This step transforms the current 855-line CLAUDE.md into a universal AGENTS.md system.

1. **Extract Universal Content from CLAUDE.md**:
   - Convention Capture System instructions → AGENTS.md (top section)
   - Universal patterns (AWS SDK, Jest mocking, etc.) → docs/wiki/
   - Project-specific content → New AGENTS.md (~275 lines)
   - Result: 855 lines → 275 lines in AGENTS.md + wiki references

2. **Create AGENTS.md from Template**:
   - Convention Capture System section (first ~75 lines)
   - Project Overview (~50 lines)
   - Critical Project-Specific Rules (~20 lines)
   - Wiki reference links (~30 lines)
   - Development workflow (~40 lines)
   - Integration points (~30 lines)
   - Common tasks (~30 lines)
   - Total: ~275 lines

3. **Replace CLAUDE.md with Passthrough** (855 lines → 1 line):
   - Back up current CLAUDE.md (for reference during migration)
   - Create new CLAUDE.md containing only: `@AGENTS.md`
   - Claude Code will automatically read AGENTS.md via this reference
   - Inherits all Convention Capture System functionality

4. **Replace GEMINI.md with Passthrough** (390 lines → 4 lines):
   - Back up current GEMINI.md
   - Create new GEMINI.md with brief pointer to AGENTS.md
   - Gemini Code Assist will read AGENTS.md

5. **Update style guides to reference docs/wiki/ paths**:
   - Replace inline patterns with links: `See [Pattern](docs/wiki/Category/Page.md)`
   - Keep project-specific examples
   - Result: 2,328 lines → ~400 lines total

**Outcome**:
- **Before**: CLAUDE.md (855) + GEMINI.md (390) + Style Guides (2,328) = 3,573 lines
- **After**: AGENTS.md (275) + CLAUDE.md (1) + GEMINI.md (4) + Style Guides (400) = 680 lines
- **Reduction**: 81% reduction (2,893 lines eliminated via wiki centralization)
- **Universal**: Convention Capture System now works across ALL projects via AGENTS.md
4. Remove duplicated content from existing files

### Step 4: Validation & Testing
1. Test all Wiki links from project
2. Have new contributor follow Wiki
3. Verify AI agents can navigate
4. Check for content gaps

## Benefits & Impact

### Immediate Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| AI Context Size | 855 lines | 200 lines | 76% reduction |
| Duplication | High | Minimal | 85% eliminated |
| Discovery Time | 10-15 min | 2-3 min | 80% faster |
| Update Effort | Multiple files | Single Wiki | 90% reduction |

### Long-term Benefits

1. **Consistency**: Same patterns across all projects
2. **Knowledge Preservation**: Team conventions documented
3. **Onboarding**: New developers productive faster
4. **Evolution**: Pattern improvements benefit all projects
5. **Collaboration**: Team can contribute to Wiki

## Success Metrics

### Quantitative Metrics
- **Wiki Pages Created**: Target 20-25 pages in docs/wiki/
- **Context Reduction**: 855 → 200 lines (76%)
- **Cross-References**: 50+ links from projects
- **Reuse Count**: Applied to 2+ projects within Q1
- **Search Time**: Find any pattern in < 30 seconds
- **Wiki Sync Time**: < 30 seconds from merge to published
- **Sync Reliability**: 100% success rate on automated sync

### Qualitative Metrics
- **Developer Satisfaction**: Survey before/after
- **Onboarding Speed**: Time to first PR
- **Pattern Compliance**: Code review feedback
- **Documentation Quality**: Completeness and clarity
- **Team Adoption**: Active Wiki contributions
- **Wiki Discoverability**: Can users find wiki via GitHub interface?
- **Wiki Navigation**: Can users navigate without confusion?

### Required Technical Outcomes
- ✅ **GitHub Wiki enabled** and accessible
- ✅ **Automated sync workflow** running successfully
- ✅ **Sidebar navigation** auto-generated from structure
- ✅ **Links work** in both docs/wiki/ and GitHub Wiki
- ✅ **Footer attribution** linking back to source
- ✅ **Zero manual sync** required after setup

## Risk Management

### Identified Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Content Loss | High | Git archive before migration |
| Broken Links | Medium | Automated link checker in CI |
| Version Mismatch | Medium | Wiki versioning strategy |
| Access Control | Low | GitHub Wiki permissions |
| Adoption Resistance | Medium | Gradual rollout, clear benefits |

### Rollback Plan
1. All original files preserved in git history
2. Can restore CLAUDE.md/GEMINI.md if needed
3. Wiki content exportable as markdown
4. Gradual migration allows partial rollback

## Maintenance Strategy

### Wiki Governance
1. **Ownership**: Team lead reviews major changes
2. **Contribution**: PR-style reviews for Wiki edits
3. **Versioning**: Tag Wiki for major releases
4. **Evolution**: Quarterly pattern review meetings

### Update Process
1. Propose pattern change in issue
2. Discuss with team
3. Update Wiki page
4. Update affected projects
5. Announce in team channels

## Timeline & Milestones

### Week 1: Foundation
- ✅ Create Wiki structure
- ✅ Core conventions (4 pages)
- ✅ Navigation system
- ✅ Initial testing

### Week 2: Testing Patterns
- ✅ Jest mocking strategy
- ✅ Type annotation policies
- ✅ Coverage philosophy
- ✅ Integration patterns

### Week 3: AWS Patterns
- ✅ SDK encapsulation
- ✅ Lambda patterns
- ✅ Logging standards
- ✅ Enforcement scripts

### Week 4: Wiki Sync & Project Updates
- ✅ GitHub Wiki sync setup (workflows + scripts)
- ✅ Test automated sync with first pages
- ✅ AGENTS.md template
- ✅ CLAUDE.md and GEMINI.md passthroughs
- ✅ Style guide updates
- ✅ Remove duplicate content

### Week 5: Final Validation
- ✅ Link verification
- ✅ Onboarding test
- ✅ AI agent test
- ✅ Gap analysis

## GitHub Wiki Sync Strategy

### Overview

**Recommendation**: Implement automated, zero-maintenance sync from `docs/wiki/` to GitHub Wiki using GitHub Actions.

**Architecture**:
```
Main Repository (docs/wiki/)          GitHub Wiki Repository
        ↓                                      ↓
  Source of Truth              ←→        Public View/Mirror
  Git tracked, PR reviewed     GitHub Actions     Auto-synced on push
  Edit in VS Code              Workflow           Beautiful web UI
```

### Why Sync to GitHub Wiki?

**Benefits for Users**:
- ✅ Beautiful, searchable web interface
- ✅ Mobile-friendly viewing
- ✅ Built-in GitHub navigation
- ✅ No git/repo knowledge needed
- ✅ Sidebar navigation auto-generated

**Benefits for Developers**:
- ✅ Edit in VS Code with full IDE support
- ✅ Changes reviewed via PRs
- ✅ Version controlled with code
- ✅ Works offline
- ✅ Grep/search wiki content locally

**Benefits for Maintainers**:
- ✅ Zero manual maintenance after setup
- ✅ Automatic sync on every merge to master
- ✅ Single source of truth (docs/wiki/)
- ✅ Clear audit trail
- ✅ Rollback via git

### Implementation Components

#### 1. GitHub Actions Workflow

**File**: `.github/workflows/sync-wiki.yml`

Triggers:
- When `docs/wiki/**` changes on master
- Manual trigger via GitHub Actions UI

Actions:
1. Checkout main repository
2. Checkout wiki repository (separate git repo)
3. Run sync script (copy files, transform links)
4. Generate navigation sidebar
5. Commit and push to wiki repo

**Execution time**: ~30 seconds
**Cost**: $0 (within GitHub Actions free tier)

#### 2. Sync Script

**File**: `.github/scripts/sync-wiki.sh`

Responsibilities:
- Clean wiki directory (preserve .git)
- Copy all markdown files from docs/wiki/
- Transform relative links for wiki format
- Generate _Sidebar.md for navigation
- Generate _Footer.md with source attribution

**Link Transformation**:
```bash
# Before (in docs/wiki/):
See [Naming Conventions](docs/wiki/Conventions/Naming-Conventions.md)

# After (in wiki):
See [Naming Conventions](Conventions/Naming-Conventions)
```

Uses `sed` to remove path prefixes and file extensions.

#### 3. Sidebar Generator

**File**: `.github/scripts/generate-sidebar.sh`

Auto-generates navigation from directory structure:
```markdown
# Documentation

## Quick Start
- [Home](Home)
- [Getting Started](Getting-Started)

### Conventions
- [Naming Conventions](Conventions/Naming-Conventions)
- [Git Workflow](Conventions/Git-Workflow)

### TypeScript
- [Lambda Function Patterns](TypeScript/Lambda-Function-Patterns)
...
```

Updates automatically as pages are added/removed.

#### 4. Directory Structure Handling

**Chosen Approach**: Preserve directory structure (GitHub Wikis support subdirectories as of 2023)

```
wiki/
├── Home.md
├── Getting-Started.md
├── Conventions/
│   ├── Naming-Conventions.md
│   └── Git-Workflow.md
├── TypeScript/
│   └── Lambda-Function-Patterns.md
└── ...
```

**Benefits**:
- Organized by category
- Clear file relationships
- Matches main repo structure
- Easier to navigate

### Edge Case Handling

**Deleted Files**:
- Sync script cleans wiki directory first
- Removed files automatically disappear

**Renamed Files**:
- Shows as delete + add in wiki history
- Full history preserved in main repo

**Broken Links**:
- Add link checker to main repo CI
- Validate links before merge to master
- Prevents broken links from reaching wiki

**Large Changes**:
- All changes reviewed via PR first
- Wiki sync is just publication step
- No surprises in wiki

### Security & Permissions

**GitHub Token**:
- Uses automatic `GITHUB_TOKEN`
- Has write access to wiki repository
- No additional secrets needed
- Scoped to repository only

**Access Control**:
- Main repo's master branch: Protected
- Wiki repository: Not protected (read-only for users)
- All changes via PR review in main repo

### Monitoring & Debugging

**Check sync status**:
```bash
# View workflow runs
gh run list --workflow=sync-wiki.yml

# View specific run
gh run view <run-id> --log
```

**Manual trigger**:
```bash
gh workflow run sync-wiki.yml
```

**Local testing**:
```bash
# Clone wiki locally
git clone https://github.com/user/repo.wiki.git test-wiki

# Test sync script
WIKI_TARGET=test-wiki bash .github/scripts/sync-wiki.sh

# Review changes
cd test-wiki && git diff
```

### Initial Setup Process

**One-Time Setup** (30 minutes):

1. **Enable Wiki**:
   - Go to repository Settings → Features
   - Check "Wikis"

2. **Create workflow file**:
   - `.github/workflows/sync-wiki.yml`
   - Copy from implementation guide

3. **Create sync scripts**:
   - `.github/scripts/sync-wiki.sh`
   - `.github/scripts/generate-sidebar.sh`
   - Make executable: `chmod +x .github/scripts/*.sh`

4. **Create initial wiki page**:
   - `docs/wiki/Home.md`
   - Basic welcome content

5. **Test the sync**:
   - Push to master
   - Watch GitHub Actions run
   - Verify wiki appears at `github.com/user/repo/wiki`

6. **Validate**:
   - Check links work
   - Verify sidebar navigation
   - Test search functionality

### Ongoing Maintenance

**Required**: Zero

The workflow automatically:
- Detects changes to docs/wiki/
- Syncs to GitHub Wiki
- Updates navigation
- Handles additions/deletions/renames

**Developer workflow**:
1. Edit docs/wiki/ files locally
2. Open PR with changes
3. Get review, merge to master
4. GitHub Actions syncs automatically
5. Wiki updated within 30 seconds

No manual steps required.

### Alternative: Manual Sync

If automation not desired, simple manual approach:

```bash
# bin/sync-wiki.sh
#!/usr/bin/env bash
git clone https://github.com/${REPO}.wiki.git .wiki
rsync -av --delete docs/wiki/ .wiki/ --exclude .git
cd .wiki && git add . && git commit -m "Sync" && git push
```

Run when wiki changes: `./bin/sync-wiki.sh`

**Not recommended** because:
- Easy to forget
- Wiki can get out of sync
- No link transformation
- No sidebar generation

### Implementation Requirement

**Automated GitHub Actions sync is REQUIRED for project completion**:
- One-time setup: 30 minutes (1-2 hours)
- Ongoing maintenance: 0 hours
- Ensures wiki always up-to-date
- Professional, maintainable solution
- Non-negotiable component of this plan

**Why this is mandatory**:
- Without automation, wiki sync becomes a manual chore that will be forgotten
- Manual sync leads to outdated documentation, defeating the purpose
- GitHub Wiki provides essential discoverability and search
- Automated sync provides the best of both worlds: Git-tracked source + beautiful web UI
- Zero maintenance after setup means sustainable long-term solution

**Implementation timeline** (integrated into main phases):
- Week 4: Set up GitHub Actions workflow and scripts
- Week 4: Test sync with initial pages
- Week 5: Validate sync works for all pages
- Week 5: Final verification and documentation

## Convention Capture System

### The Critical Meta-Problem

**Challenge**: Valuable conventions emerge organically during development work but often aren't captured, leading to:
- Repeated explanations of the same patterns
- Inconsistent application across projects
- Knowledge loss between sessions
- Documentation debt that never gets paid
- AI assistants not knowing project-specific conventions

**Solution**: Systematic, real-time capture of emergent conventions as they arise.

### How It Works

#### Layer 1: Real-Time Detection (During Work)

When AI assistant detects a convention emerging, flag it immediately:

```
🔔 **Convention Detected**

**Name**: AGENTS.md Filename Standard
**Type**: Convention
**Context**: Industry standard for AI tool context files
**Proposed Location**: docs/wiki/Meta/AI-Tool-Context-Files.md

Document now? [Y/N]
```

**Detection Triggers**:
| Signal | Examples | Action |
|--------|----------|--------|
| Explicit Statement | "Always use X", "Never do Y" | Immediate flag |
| Correction | "Actually, it's AGENTS.md plural" | High priority |
| Strong Language | "MUST", "REQUIRED", "CRITICAL" | Zero-tolerance rule |
| Repeated Pattern | Same decision 2+ times | Detect pattern |
| Meta-Discussion | "How should we handle..." | Methodology |

#### Layer 2: Conventions Tracking Document

**File**: `docs/conventions-tracking.md`

Central registry of all detected conventions and documentation status:

```markdown
## 🟡 Pending Documentation

### Detected: 2025-11-22 (Session: GitHub Wiki Organization)

1. **AGENTS.md Standard** (Convention)
   - **What**: Use AGENTS.md (plural) as AI context filename
   - **Why**: Industry standard (OpenAI, GitHub Copilot support)
   - **Target**: docs/wiki/Meta/AI-Tool-Context-Files.md
   - **Priority**: HIGH
   - **Status**: ⏳ Pending

2. **Passthrough File Pattern** (Pattern)
   - **What**: Keep tool-specific files as passthroughs
   - **Example**: CLAUDE.md contains "@AGENTS.md"
   - **Target**: docs/wiki/Meta/Documentation-Patterns.md
   - **Priority**: MEDIUM
   - **Status**: ⏳ Pending

## 🟢 Recently Documented
- [x] **AWS SDK Encapsulation Policy** → docs/wiki/AWS/
- [x] **No AI Attribution in Commits** → docs/wiki/Conventions/
```

#### Layer 3: End-of-Session Summary

AI assistant automatically generates:

```markdown
## 📝 Session Summary: GitHub Wiki Organization

**Date**: 2025-11-22
**Conventions Detected**: 4

### New Conventions

1. ✅ **AGENTS.md Standard** (Convention)
   - Documented: Partially (in plan)
   - Needs: Wiki page creation

2. ✅ **Automated Sync as Requirement** (Philosophy)
   - Documented: Yes (in plan)
   - Needs: Extract to methodology page

3. ✅ **Passthrough File Pattern** (Pattern)
   - Documented: Yes (in plan)
   - Needs: Reusable template

4. ✅ **Git-Based Wiki Storage** (Methodology)
   - Documented: Yes (in plan)
   - Needs: Wiki page

### Recommended Actions

[ ] Create 4 new wiki pages
[ ] Update conventions-tracking.md
[ ] Add references to AGENTS.md

**Proceed with documentation?**
```

#### Layer 4: Live Wiki Page

**File**: `docs/wiki/Meta/Emerging-Conventions.md`

Real-time append-only log updated during sessions:

```markdown
# Emerging Conventions

## Session: 2025-11-22 (GitHub Wiki Organization)

### 14:30 - AGENTS.md Standard
- **Type**: Convention
- **Status**: 🟡 Pending documentation
- **Context**: Use AGENTS.md (plural) not AGENT.md
- **Why**: Industry standard supported by 20+ tools
- **Action**: Create docs/wiki/Meta/AI-Tool-Context-Files.md

### 15:15 - Passthrough File Pattern
- **Type**: Pattern
- **Status**: 🟡 Pending documentation
- **Context**: Tool-specific files point to universal source
- **Example**: CLAUDE.md → "@AGENTS.md"
- **Action**: Document pattern with template

---

## Previous Sessions
[Historical record...]
```

#### Layer 5: Structured Capture Template

Every convention documented using consistent format:

```markdown
# [Convention Name]

## Classification
- **Type**: Convention | Pattern | Rule | Methodology | Philosophy
- **Category**: [Which wiki category]
- **Enforcement**: Zero-tolerance | Enforced | Recommended

## The Rule
[One-sentence clear statement]

## Context & Rationale
**Problem Solved**: [What problem this addresses]
**Origin**: [How it emerged - date, session, context]
**Benefits**: [Why this matters]

## Examples
### ✅ Correct
[Example following convention]

### ❌ Incorrect
[Anti-pattern violating convention]

## Enforcement
- **Detection**: [How to spot violations]
- **Automation**: [CI checks, linters, scripts]

## Evolution History
- **2025-11-22**: Initial detection during GitHub Wiki planning
- **2025-XX-XX**: [Future refinements]

## Related Patterns
- [Link to related convention 1]
- [Link to related convention 2]
```

### Implementation in Wiki Structure

**New Meta/ Category**:
```
docs/wiki/Meta/
├── Working-with-AI-Assistants.md    # How to work with AI
├── Convention-Capture-System.md     # This system
├── Emerging-Conventions.md          # Live log
├── AI-Tool-Context-Files.md         # AGENTS.md standard
└── Documentation-Patterns.md        # Passthrough files
```

### Example: Capturing AGENTS.md Convention

**Real-Time (During Session)**:
```
User: "Use AGENTS.md plural, not AGENT.md"

AI: 🔔 **Convention Detected**
Name: AGENTS.md Filename Standard
Document now? [Y]

AI: Creating docs/wiki/Meta/AI-Tool-Context-Files.md...
```

**Tracking Document**:
```markdown
## 🟡 Pending → 🟢 Documented

1. **AGENTS.md Standard**
   - ✅ Wiki page created
   - ✅ Added to AGENTS.md references
   - ✅ Updated conventions-tracking.md
```

**End of Session**:
```markdown
## Conventions Documented Today
- ✅ AGENTS.md Standard → docs/wiki/Meta/AI-Tool-Context-Files.md
- ⏳ Passthrough Pattern (pending)
- ⏳ Git-Based Wiki (pending)

3 conventions detected, 1 documented, 2 pending.
Next session: Document remaining 2?
```

### Integration with AI Assistant Workflow

**Start of Each Session**:
```
AI: 📋 Pending Conventions from Last Session:
- Passthrough File Pattern (not yet documented)
- Git-Based Wiki Storage (not yet documented)

Should we document these before new work?
```

**During Session**:
```
AI: [Detects convention]
AI: 🔔 Convention detected: [Name]
AI: [Offers to document immediately or defer]
```

**End of Session**:
```
AI: 📝 Session Summary
AI: [Lists all conventions detected]
AI: [Asks which to document]
AI: [Creates wiki pages or updates tracking]
```

### Success Criteria

- ✅ **Zero conventions lost** to conversation history
- ✅ **Real-time capture** during sessions
- ✅ **Structured documentation** in wiki
- ✅ **Tracking system** shows status
- ✅ **AI persistence** across sessions
- ✅ **Searchable** knowledge base

### Effort Estimate

**Initial Setup** (Week 1):
- Create `docs/conventions-tracking.md` (30 min)
- Create `docs/wiki/Meta/` structure (30 min)
- Document this system itself (1 hour)
- **Total**: 2 hours

**Ongoing** (Per Session):
- Real-time detection: 0 hours (automatic)
- End-of-session summary: 5 minutes (automatic)
- Documentation: 10-15 min per convention
- **Average**: 15-30 min per session

**Long-term Value**: Infinite - conventions persist forever

### Why This is Critically Important

1. **Institutional Memory**: Conventions don't disappear between sessions
2. **Consistency**: Same patterns applied everywhere
3. **Efficiency**: No repeated explanations
4. **Scalability**: New team members learn from documented conventions
5. **Evolution**: Conventions improve over time with tracked history
6. **AI Effectiveness**: AI knows project-specific patterns

This system treats **convention capture as a first-class workflow** rather than an afterthought.

## Related Documents

- [Conditional Functionality Implementation](./conditional-functionality-implementation.md)
- [Alternative Authentication Implementation](./implement-alternative-authentication.md)
- [End-to-End Testing Strategy](./enable-e2e-testing.md)

## Conclusion

This GitHub Wiki organization strategy creates a **universal, persistent system** that transcends individual projects while transforming scattered documentation into a centralized, reusable knowledge base.

### Universal Architecture Achieved

**The Three-Layer System**:

1. **Universal Layer (AGENTS.md)**:
   - Convention Capture System instructions (works across ALL projects)
   - Single source of truth for AI tool compatibility
   - 275 lines of project-specific content + universal methodology
   - Read by 20+ AI coding tools automatically

2. **Project-Specific Layer**:
   - CLAUDE.md (1 line: `@AGENTS.md`) - Inherits everything
   - GEMINI.md (4 lines) - Points to AGENTS.md
   - docs/conventions-tracking.md - Project's own conventions
   - docs/sessions/ - Project's convention discovery history

3. **Reference Implementation Layer (Wiki)**:
   - docs/wiki/ - Detailed patterns and methodologies
   - Serves as template for future projects
   - Auto-synced to GitHub Wiki for beautiful public interface
   - Zero maintenance via automated sync

### What Makes This Universal

**Convention Capture System Persistence**:
- ✅ Defined ONCE in AGENTS.md (the universal file)
- ✅ Works in EVERY project that uses AGENTS.md
- ✅ AI assistants automatically use it by reading AGENTS.md
- ✅ No need to re-explain system in each project
- ✅ True institutional memory across ALL work

**Cross-Project Benefits**:
- Create new project → Add AGENTS.md with Convention Capture section → Done
- All future AI sessions automatically capture conventions
- Methodology documented in this wiki serves as reference
- Each project builds its own convention database independently

### Transformation Summary

**Before**:
- CLAUDE.md: 855 lines (project-locked, no convention capture)
- GEMINI.md: 390 lines (duplicate content)
- Style Guides: 2,328 lines (patterns repeated)
- **Total**: 3,573 lines
- **Convention Capture**: Manual/non-existent

**After**:
- AGENTS.md: 275 lines (universal + project-specific)
- CLAUDE.md: 1 line (passthrough to AGENTS.md)
- GEMINI.md: 4 lines (passthrough to AGENTS.md)
- Style Guides: ~400 lines (wiki references)
- docs/wiki/: Centralized patterns
- **Total**: 680 lines
- **Convention Capture**: Automatic in every session
- **Reduction**: 81% (2,893 lines → wiki)
- **Persistence**: Universal across all projects

### Critical Components (Both Required)

1. **Convention Capture System** - The meta-system that ensures no knowledge is lost
2. **Automated GitHub Wiki Sync** - Zero-maintenance publication of wiki content

Without Convention Capture, conventions are lost to conversation history. Without automated sync, the wiki becomes a maintenance burden. Together, they create a self-sustaining, persistent knowledge system.

### Impact

**This Project**: Transforms 855-line CLAUDE.md into universal 275-line AGENTS.md with automated convention capture

**Future Projects**: Copy AGENTS.md template → Instant convention capture system

**All AI Sessions**: Read AGENTS.md → Automatically know to capture and preserve conventions

The phased implementation ensures no disruption to ongoing development while building a sustainable documentation system for this project and ALL future projects. The entire implementation, including wiki sync setup, takes approximately 4-5 weeks with an estimated 40-50 hours of total effort, resulting in zero ongoing maintenance and universal convention persistence.

## Next Steps

1. Review and approve this plan
2. Create docs/wiki/ directory structure (Day 1)
3. Begin Phase 1 content migration (Week 1)
4. Set up GitHub Wiki sync automation (Week 4) - **Required**
5. Create AGENTS.md + CLAUDE.md/GEMINI.md passthroughs (Week 4-5)
6. Pilot with one style guide update (Week 1)
7. Validate automated sync works (Week 4)
8. Complete all wiki pages and verify sync (Week 5)
9. Final validation and launch (Week 5)