# AI Tool Context Files

## Quick Reference
- **When to use**: Setting up AI assistant context for a project
- **Enforcement**: Recommended - ensures AI tool compatibility
- **Impact if violated**: Low - some AI tools may not auto-load context

## Overview

AI coding assistants look for specific filenames to auto-load project context. The industry has consolidated around **AGENTS.md** as the universal standard, with tool-specific passthrough files for compatibility.

## The AGENTS.md Standard

### What Is AGENTS.md?

AGENTS.md is the open standard for AI coding assistant context, maintained collaboratively by OpenAI, Amp, Google, Cursor, and Factory, with support across 20+ AI coding tools.

### Tool Support Matrix

| AI Tool | Auto-Reads AGENTS.md | Auto-Reads CLAUDE.md | Auto-Reads GEMINI.md |
|---------|---------------------|---------------------|---------------------|
| **OpenAI Codex CLI** | ✅ Yes | No | No |
| **GitHub Copilot** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Google Gemini CLI** | Configurable | No | ✅ Yes |
| **Google Gemini IDE** | ✅ Yes | No | ✅ Yes |
| **Claude Code** | No | ✅ Yes | No |
| **Cursor** | ✅ Yes | - | - |
| **Codeium** | ✅ Yes | - | - |
| **Aider** | ✅ Yes | - | - |
| **Devin** | ✅ Yes | - | - |

### Why AGENTS.md?

1. **Industry Standard** - Supported by major AI tool vendors
2. **Single Source of Truth** - One file for all tools
3. **Flexible Format** - Standard Markdown, no rigid schema
4. **Monorepo Support** - Nested files, closest takes precedence
5. **Future-Proof** - New tools adopt this standard

### Official Resource

https://agents.md

## File Architecture

### Recommended Structure

```
project/
├── AGENTS.md          # Universal context (390 lines)
├── CLAUDE.md          # Claude Code passthrough (1 line)
├── GEMINI.md          # Gemini Code Assist passthrough (4 lines)
└── docs/
    ├── wiki/          # Detailed conventions
    └── conventions-tracking.md  # Project-specific patterns
```

### Benefits

- **Single Source of Truth**: AGENTS.md is the canonical file
- **Tool Compatibility**: Passthrough files maintain compatibility
- **No Duplication**: Content defined once, referenced everywhere
- **Universal Coverage**: Works with 20+ AI coding tools

## AGENTS.md Content Structure

### Template Organization

```markdown
# Project Context for AI Agents

## Convention Capture System
[Universal detection and tracking instructions]
[Links to this wiki for methodology]

## Project Overview
[Project-specific architecture and tech stack]

## Wiki Conventions to Follow
[Links to relevant wiki pages for universal patterns]

## Critical Project-Specific Rules
[Unique requirements for THIS project only]

## Development Workflow
[Commands, tools, build process]

## Integration Points
[External services, APIs, third-party systems]

## Common Development Tasks
[Checklists for frequent operations]
```

### What Goes in AGENTS.md

**Include**:
- Convention Capture System instructions (universal)
- Project overview and architecture
- Links to wiki for universal patterns
- Project-specific unique requirements
- Development workflow commands
- Integration point details

**Exclude (put in wiki instead)**:
- Universal naming conventions
- Standard testing patterns
- Common TypeScript patterns
- AWS service usage patterns
- Git workflow rules

## Passthrough File Pattern

### CLAUDE.md Passthrough

Claude Code automatically reads CLAUDE.md. Use a passthrough to inherit AGENTS.md:

```markdown
@AGENTS.md
```

That's it. One line. Claude Code will read AGENTS.md via this reference.

### GEMINI.md Passthrough

Gemini Code Assist looks for GEMINI.md. Use a passthrough:

```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see [AGENTS.md](./AGENTS.md) for comprehensive project documentation and guidelines.
```

### Why Passthroughs?

1. **Maintains Compatibility** - Tools that look for specific names work
2. **Single Source** - No duplication, all content in AGENTS.md
3. **Easy Updates** - Change AGENTS.md, all tools get updates
4. **Clear Intent** - Explicit that AGENTS.md is canonical

## Universal Convention Persistence

### The Architecture

```
Universal Layer (AGENTS.md)
├─ Convention Capture System instructions
├─ Universal patterns and methodologies
├─ Links to wiki for detailed conventions
└─ Applies to ALL user projects

Project-Specific Layer
├─ AGENTS.md (inherits universal + adds project details)
├─ CLAUDE.md (passthrough: @AGENTS.md)
├─ GEMINI.md (passthrough to AGENTS.md)
└─ docs/conventions-tracking.md (project conventions)
```

### How It Works

1. **AGENTS.md Contains Core Instructions**:
   - How to detect conventions
   - How to track conventions
   - How to generate session summaries
   - Links to this wiki as reference

2. **Project-Specific Files**:
   - AGENTS.md adds project-specific content
   - CLAUDE.md/GEMINI.md reference AGENTS.md
   - conventions-tracking.md stores project patterns

3. **Wiki as Reference**:
   - This wiki documents universal patterns
   - Serves as template for other projects
   - Contains Meta/ section with system documentation

4. **Persistence Across Projects**:
   - AI reads AGENTS.md at start of every session
   - Convention Capture System instructions inherited
   - Each project builds own convention database
   - Universal methodology, project-specific conventions

## Creating AGENTS.md for New Projects

### Step 1: Copy Template

```bash
# Copy from this project or wiki template
cp path/to/template/AGENTS.md ./AGENTS.md
```

### Step 2: Add Project-Specific Content

```markdown
# Project Context for AI Agents

## Convention Capture System
[Copy from template - universal instructions]

## Project Overview
[YOUR project description]
- Architecture: [YOUR stack]
- Language: [YOUR languages]
- Purpose: [YOUR goals]

## Wiki Conventions to Follow
**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**
- [Naming Conventions](docs/wiki/Conventions/Naming-Conventions.md)
- [Git Workflow](docs/wiki/Conventions/Git-Workflow.md)
- [Add relevant patterns for YOUR project]

## Critical Project-Specific Rules
[YOUR unique requirements]
[YOUR integrations]
[YOUR constraints]

## Development Workflow
[YOUR commands]
[YOUR build process]
[YOUR deployment]
```

### Step 3: Create Passthrough Files

**CLAUDE.md**:
```markdown
@AGENTS.md
```

**GEMINI.md**:
```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth.

Please see [AGENTS.md](./AGENTS.md) for documentation.
```

### Step 4: Initialize Convention Tracking

```bash
# Create convention tracking file
touch docs/conventions-tracking.md
```

Add initial content:
```markdown
# Convention Tracking

## 🟢 Initial Conventions

### Project Setup - [Date]
- AGENTS.md created with Convention Capture System
- Passthrough files configured
- Ready for convention detection

## 📊 Statistics
- Total Detected: 0
- Documented: 0
- Pending: 0
```

## Migration from Existing Projects

### From CLAUDE.md Only

```bash
# 1. Backup existing file
cp CLAUDE.md CLAUDE.md.backup

# 2. Rename to AGENTS.md
mv CLAUDE.md AGENTS.md

# 3. Create new CLAUDE.md passthrough
echo "@AGENTS.md" > CLAUDE.md

# 4. Create GEMINI.md passthrough
cat > GEMINI.md << 'EOF'
# See AGENTS.md

This project uses AGENTS.md as the single source of truth.

Please see [AGENTS.md](./AGENTS.md) for documentation.
EOF
```

### From Duplicate Files (CLAUDE.md + GEMINI.md)

```bash
# 1. Identify canonical file (usually most complete)
# 2. Rename canonical to AGENTS.md
mv CLAUDE.md AGENTS.md

# 3. Create passthrough files
echo "@AGENTS.md" > CLAUDE.md

cat > GEMINI.md << 'EOF'
# See AGENTS.md
Please see [AGENTS.md](./AGENTS.md) for documentation.
EOF
```

## Benefits of This Architecture

### For Developers

✅ Edit context in one place (AGENTS.md)
✅ Works with any AI coding tool
✅ No duplication or sync issues
✅ Clear project documentation

### For AI Assistants

✅ Automatically load context on session start
✅ Inherit Convention Capture System
✅ Access project-specific rules
✅ Reference wiki for universal patterns

### For Teams

✅ Consistent across all AI tools
✅ Single file to review in PRs
✅ Easy to onboard new developers
✅ Convention system works automatically

## Common Patterns

### Monorepo with Multiple Projects

```
monorepo/
├── AGENTS.md              # Root-level common context
├── packages/
│   ├── frontend/
│   │   └── AGENTS.md      # Frontend-specific (takes precedence)
│   └── backend/
│       └── AGENTS.md      # Backend-specific (takes precedence)
```

Closest AGENTS.md to current directory wins.

### Shared Wiki Across Projects

```
project-a/
├── AGENTS.md              # Project A context
├── CLAUDE.md              # @AGENTS.md
└── docs/wiki/ → symlink to shared-wiki/

project-b/
├── AGENTS.md              # Project B context
├── CLAUDE.md              # @AGENTS.md
└── docs/wiki/ → symlink to shared-wiki/

shared-wiki/
└── [Universal conventions]
```

Multiple projects can reference same wiki.

## Troubleshooting

### AI Tool Not Reading AGENTS.md

1. Check tool supports AGENTS.md (see matrix above)
2. Verify file is in project root
3. Check file permissions (must be readable)
4. Try explicit reference in tool settings

### Passthrough Not Working

1. Verify exact syntax: `@AGENTS.md` for Claude
2. Check AGENTS.md exists and is readable
3. Try restarting AI tool
4. Check for typos in filename

### Content Not Updating

1. Verify editing AGENTS.md, not passthrough
2. Some tools cache - restart or clear cache
3. Check file saved and not read-only

## Related Documentation

- [Convention Capture System](Convention-Capture-System.md) - How conventions persist
- [Documentation Patterns](Documentation-Patterns.md) - Passthrough file patterns
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Effective collaboration

---

*Use AGENTS.md as the single source of truth for AI tool context. Maintain compatibility with tool-specific passthrough files. This ensures Convention Capture System works across all projects and tools.*