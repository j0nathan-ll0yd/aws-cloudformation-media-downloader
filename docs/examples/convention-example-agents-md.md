# AGENTS.md Filename Standard

## Classification
- **Type**: Convention
- **Enforcement**: Recommended
- **Scope**: Project-wide
- **Category**: Documentation

## The Rule

Use `AGENTS.md` (plural) as the filename for AI coding assistant context files, not `AGENT.md` (singular).

## Context & Rationale

### Problem Solved
Different AI coding tools look for different context files (CLAUDE.md, GEMINI.md, CURSOR.md, etc.), creating maintenance burden when maintaining multiple tool-specific files with duplicate content.

### Origin
Emerged during GitHub Wiki organization planning when researching AI tool compatibility. Discovered that AGENTS.md (plural) is the industry-standard filename supported by:
- OpenAI Codex CLI (`/init` command creates AGENTS.md)
- GitHub Copilot
- Google Gemini
- Cursor IDE
- 20+ other AI coding tools

### Benefits
- **Single Source of Truth**: One file to maintain instead of many
- **Industry Standard**: Follows convention used by major AI tool providers
- **Tool Compatibility**: Automatically detected by most AI coding assistants
- **Future-Proof**: New AI tools likely to support this standard
- **Reduced Maintenance**: Update once, works everywhere

## Examples

### ✅ Correct

```
repository/
├── AGENTS.md          # ← Universal source of truth
├── CLAUDE.md          # ← Passthrough file: "@AGENTS.md"
├── GEMINI.md          # ← Passthrough file: "See AGENTS.md"
└── src/
```

**AGENTS.md** contains the comprehensive project context:
```markdown
# Project Context for AI Assistants

## Project Overview
This is a serverless AWS media downloader...

## Architecture
...
```

**CLAUDE.md** (passthrough):
```markdown
@AGENTS.md
```

**GEMINI.md** (passthrough):
```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth.

Please see [AGENTS.md](./AGENTS.md) for comprehensive documentation.
```

**Why this works:**
- Tool-agnostic: AGENTS.md works with all tools
- Backwards compatible: Existing CLAUDE.md/GEMINI.md still work
- Minimal maintenance: Passthrough files rarely change
- Clear hierarchy: Obvious which file is authoritative

### ❌ Incorrect

```
repository/
├── AGENT.md           # ← Singular (non-standard)
├── CLAUDE.md          # ← Duplicate content
├── GEMINI.md          # ← Duplicate content
└── src/
```

**Or even worse:**

```
repository/
├── CLAUDE.md          # ← No universal file
├── GEMINI.md          # ← Duplicate content
└── src/
```

**Why this fails:**
- `AGENT.md` (singular) is not an industry standard
- Duplicate content in multiple files = maintenance nightmare
- No clear single source of truth
- Future AI tools may not detect non-standard filenames
- Inconsistencies emerge when updating one but not others

## Enforcement

### Detection
**Code Review Checklist:**
- [ ] Is there an `AGENTS.md` file in the repository root?
- [ ] Does `AGENTS.md` contain comprehensive project context?
- [ ] Are tool-specific files (`CLAUDE.md`, `GEMINI.md`) passthrough files?
- [ ] Is `AGENT.md` (singular) used anywhere? (If yes, rename to AGENTS.md)

**Automated Detection:**
Could be automated with pre-commit hook:
```bash
# Check for AGENT.md (singular) and suggest AGENTS.md
if [ -f "AGENT.md" ] && [ ! -f "AGENTS.md" ]; then
  echo "❌ Found AGENT.md - should be AGENTS.md (plural)"
  exit 1
fi
```

### Automation
- **GitHub Actions**: Could check for AGENTS.md presence in CI
- **Documentation Linting**: Verify passthrough files are minimal
- **Dependency Check**: Ensure CLAUDE.md/GEMINI.md reference AGENTS.md

### Consequences
**If violated:**
- Some AI tools may not auto-detect project context
- Increased maintenance burden from duplicate content
- Potential inconsistencies across tool-specific files
- Confusion about which file is authoritative

## Related Patterns

- [Passthrough File Pattern](./passthrough-file-pattern.md) - Technique for tool-specific compatibility files
- [Documentation Single Source of Truth](../../styleGuides/documentationStyleGuide.md) - Broader principle applied here

## Evolution History

- **2025-11-22**: Convention established during GitHub Wiki organization planning
  - Initially considered AGENT.md (singular)
  - Research revealed AGENTS.md (plural) is industry standard
  - Confirmed OpenAI Codex CLI uses AGENTS.md

## See Also

- [OpenAI Codex CLI Documentation](https://developers.openai.com/codex/cli/) - Uses AGENTS.md
- [GitHub Copilot Documentation](https://docs.github.com/copilot) - Supports AGENTS.md
- [Project CLAUDE.md](../../CLAUDE.md) - Example passthrough file implementation

## Implementation Checklist

When implementing this convention:

- [ ] Create `AGENTS.md` in repository root
- [ ] Move comprehensive content to `AGENTS.md`
- [ ] Convert `CLAUDE.md` to passthrough: `@AGENTS.md`
- [ ] Convert `GEMINI.md` to passthrough with brief explanation
- [ ] Delete or rename any `AGENT.md` (singular) files
- [ ] Update documentation to reference `AGENTS.md`
- [ ] Test with multiple AI coding tools
- [ ] Add to project README or contribution guidelines

## Tool Support Matrix

| AI Tool | Auto-Reads AGENTS.md | Notes |
|---------|---------------------|-------|
| OpenAI Codex CLI | ✅ Yes | `/init` creates AGENTS.md |
| GitHub Copilot | ✅ Yes | Reads all, nearest precedence |
| Google Gemini | ✅ Yes | Via Code Assist |
| Cursor IDE | ✅ Yes | Full support |
| Claude Code | Via CLAUDE.md passthrough | Needs CLAUDE.md for auto-detection |
| Windsurf | ✅ Yes | Full support |
| Continue.dev | ✅ Yes | Configurable |
| Cody | ✅ Yes | Via workspace context |

---

**Status**: Active
**Last Updated**: 2025-11-22
**Detected**: 2025-11-22 during GitHub Wiki organization planning
**Priority**: High
**Category**: Documentation / AI Tools
