# AI Tool Context Files

## Quick Reference
- **When to use**: Setting up AI assistant context for a project
- **Enforcement**: Recommended - ensures AI tool compatibility
- **Impact if violated**: Low - some AI tools may not auto-load context

## Overview

AI coding assistants look for specific filenames to auto-load project context. The industry has consolidated around **AGENTS.md** as the universal standard, with tool-specific passthrough files for compatibility.

## The AGENTS.md Standard

AGENTS.md is the open standard for AI coding assistant context, maintained collaboratively by OpenAI, Amp, Google, Cursor, and Factory, with support across 20+ AI coding tools.

### Tool Support Matrix

| AI Tool | Auto-Reads AGENTS.md | Auto-Reads CLAUDE.md | Auto-Reads GEMINI.md |
|---------|---------------------|---------------------|---------------------|
| **OpenAI Codex CLI** | ✅ Yes | No | No |
| **GitHub Copilot** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Google Gemini CLI** | Configurable | No | ✅ Yes |
| **Claude Code** | No | ✅ Yes | No |
| **Cursor** | ✅ Yes | - | - |
| **Codeium** | ✅ Yes | - | - |

**Official Resource**: https://agents.md

## File Architecture

### Recommended Structure

```
project/
├── AGENTS.md          # Universal context (single source of truth)
├── CLAUDE.md          # Claude Code passthrough (1 line)
├── GEMINI.md          # Gemini Code Assist passthrough (4 lines)
└── docs/
    └── wiki/          # All documentation (including Conventions-Tracking.md)
```

### Benefits
- Single source of truth in AGENTS.md
- Tool compatibility via passthrough files
- No duplication or sync issues
- Works with 20+ AI coding tools

## AGENTS.md Content Structure

```markdown
# Project Context for AI Agents

## Convention Capture System
[Universal detection and tracking instructions]

## Project Overview
[Project-specific architecture and tech stack]

## Wiki Conventions to Follow
[Links to relevant wiki pages]

## Critical Project-Specific Rules
[Unique requirements for THIS project only]

## Development Workflow
[Commands, tools, build process]
```

### What Goes in AGENTS.md

**Include**:
- Convention Capture System instructions (universal)
- Project overview and architecture
- Links to wiki for universal patterns
- Project-specific unique requirements
- Development workflow commands

**Exclude (put in wiki instead)**:
- Universal naming conventions
- Standard testing patterns
- Common TypeScript patterns
- AWS service usage patterns

## Passthrough File Pattern

### CLAUDE.md Passthrough

```markdown
@AGENTS.md
```

That's it. One line. Claude Code will read AGENTS.md via this reference.

### GEMINI.md Passthrough

```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see AGENTS.md in the repository root for comprehensive project documentation and guidelines.
```

## Creating AGENTS.md for New Projects

### Step 1: Copy Template

```bash
cp path/to/template/AGENTS.md ./AGENTS.md
```

### Step 2: Add Project-Specific Content

Edit AGENTS.md to include:
- Your project description
- Your architecture stack
- Your specific requirements
- Your development commands

### Step 3: Create Passthrough Files

**CLAUDE.md**:
```markdown
@AGENTS.md
```

**GEMINI.md**:
```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth.

Please see AGENTS.md for documentation.
```

### Step 4: Initialize Convention Tracking

```bash
touch docs/wiki/Meta/Conventions-Tracking.md
```

## Migration from Existing Projects

### From CLAUDE.md Only

```bash
# Rename to AGENTS.md
mv CLAUDE.md AGENTS.md

# Create new CLAUDE.md passthrough
echo "@AGENTS.md" > CLAUDE.md

# Create GEMINI.md passthrough
cat > GEMINI.md << 'EOF'
# See AGENTS.md
Please see AGENTS.md for documentation.
EOF
```

## Benefits

### For Developers
- Edit context in one place (AGENTS.md)
- Works with any AI coding tool
- No duplication or sync issues

### For AI Assistants
- Automatically load context on session start
- Inherit Convention Capture System
- Access project-specific rules

### For Teams
- Consistent across all AI tools
- Single file to review in PRs
- Easy onboarding

## Related Documentation

- [Convention Capture System](Convention-Capture-System.md) - How conventions persist
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Effective collaboration

---

*Use AGENTS.md as the single source of truth for AI tool context. Maintain compatibility with tool-specific passthrough files.*
