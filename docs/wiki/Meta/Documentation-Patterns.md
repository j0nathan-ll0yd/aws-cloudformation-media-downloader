# Documentation Patterns

## Quick Reference
- **When to use**: Organizing documentation across projects
- **Enforcement**: Recommended - maintains consistency
- **Impact if violated**: Low - may have disorganized docs

## Overview

This document describes patterns for organizing documentation, using passthrough files, and maintaining single sources of truth across multiple AI coding tools and documentation systems.

## Passthrough File Pattern

### Concept

A **passthrough file** is a minimal file that references a canonical source, allowing multiple tools to access the same content while maintaining compatibility with different naming conventions.

### Structure

```
Canonical Source (AGENTS.md)
       ↓
   References
       ↓
Passthrough Files (CLAUDE.md, GEMINI.md)
```

### Benefits

1. **Single Source of Truth** - Content defined once
2. **Tool Compatibility** - Works with multiple AI tools
3. **No Duplication** - Eliminates sync issues
4. **Easy Maintenance** - Update one file
5. **Clear Ownership** - Explicit canonical source

## Implementation Examples

### Claude Code Passthrough

**File**: `CLAUDE.md`

```markdown
@AGENTS.md
```

**How it works**:
- Claude Code reads CLAUDE.md
- Sees `@AGENTS.md` reference
- Loads and processes AGENTS.md content
- Behaves as if AGENTS.md content was in CLAUDE.md

### Gemini Code Assist Passthrough

**File**: `GEMINI.md`

```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see AGENTS.md in the repository root for comprehensive project documentation and guidelines.
```

**How it works**:
- Gemini reads GEMINI.md
- Follows Markdown link to AGENTS.md
- Loads and processes AGENTS.md content

### Documentation Wiki Passthrough

**File**: `README.md` or docs page

```markdown
# [Topic] Documentation

For comprehensive documentation on testing patterns, see the wiki:

- [Jest ESM Mocking Strategy](../Testing/Jest-ESM-Mocking-Strategy.md)
- [Lazy Initialization Pattern](../Testing/Lazy-Initialization-Pattern.md)

This keeps documentation centralized and avoids duplication.
```

## Wiki Organization Pattern

### Git-Based Wiki

Store wiki content in main repository for version control and IDE integration:

```
docs/
└── wiki/
    ├── Home.md
    ├── Getting-Started.md
    ├── Conventions/
    │   ├── Naming-Conventions.md
    │   └── Git-Workflow.md
    ├── TypeScript/
    │   └── Lambda-Function-Patterns.md
    └── Meta/
        └── Documentation-Patterns.md
```

### Auto-Sync to GitHub Wiki

Use GitHub Actions to automatically sync to wiki:

```
docs/wiki/ (Git)  →  GitHub Actions  →  GitHub Wiki (Public)
Source of Truth      Auto-sync on       Beautiful UI
PR reviewed          push to master     Search enabled
```

Benefits:
- ✅ Edit in VS Code with full IDE support
- ✅ Changes reviewed via PRs
- ✅ Version controlled with code
- ✅ Beautiful web interface for users
- ✅ Zero manual maintenance

## Page Template Pattern

### Standard Convention Page

```markdown
# [Convention Name]

## Quick Reference
- **When to use**: [One-line description]
- **Enforcement**: [Zero-tolerance/Required/Recommended]
- **Impact if violated**: [Critical/High/Medium/Low]

## The Rule
[Clear, concise statement of the convention]

## Examples
### ✅ Correct
[Good example with code]

### ❌ Incorrect
[Bad example with code]

## Rationale
[Why this convention exists]

## Enforcement
[How to check/automate compliance]

## Exceptions
[When this pattern doesn't apply]

## Related Patterns
- Link to related convention 1 (e.g., Error Handling)
- Link to related convention 2 (e.g., Testing Patterns)
```

### Why This Template?

1. **Quick Reference** - Developers get essence immediately
2. **Clear Rules** - No ambiguity about what's required
3. **Learning by Example** - Visual comparison of good/bad
4. **Context** - Rationale explains the "why"
5. **Actionable** - Enforcement section shows how to apply
6. **Discoverable** - Related patterns aid navigation

## Reference Pattern

### From Application Code

```typescript
// ✅ GOOD - Reference wiki in code comments
/**
 * Validates user credentials
 *
 * See: docs/wiki/TypeScript/Error-Handling.md
 */
function validateCredentials(username: string, password: string) {
  // Implementation
}
```

### From Style Guides

```markdown
# Lambda Style Guide

## AWS SDK Usage

This project follows strict AWS SDK encapsulation rules.

See [SDK Encapsulation Policy](../AWS/SDK-Encapsulation-Policy.md) for complete details.

## Project-Specific Examples

[Local examples using project code...]
```

### From AGENTS.md

```markdown
# Project Context for AI Agents

## Wiki Conventions to Follow

**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**

### Core Conventions
- [Git Workflow](../Conventions/Git-Workflow.md) - NO AI attribution
- [Naming](../Conventions/Naming-Conventions.md) - camelCase rules

### Language-Specific
- [Lambda](../TypeScript/Lambda-Function-Patterns.md)
- [Testing](../Testing/Jest-ESM-Mocking-Strategy.md)
- [AWS SDK](../AWS/SDK-Encapsulation-Policy.md) - ZERO tolerance
```

## Multi-Project Documentation

### Shared Wiki Pattern

For organizations with multiple similar projects:

```
shared-conventions/
└── wiki/
    ├── TypeScript/
    ├── Testing/
    └── AWS/

project-a/
├── AGENTS.md (references shared wiki)
└── docs/
    └── conventions-tracking.md (project-specific)

project-b/
├── AGENTS.md (references shared wiki)
└── docs/
    └── conventions-tracking.md (project-specific)
```

### Symlink Pattern

```bash
# In each project
cd docs
ln -s ../../shared-conventions/wiki wiki

# Now wiki pages accessible from all projects
```

### Submodule Pattern

```bash
# Add shared wiki as submodule
git submodule add https://github.com/org/shared-wiki docs/wiki

# Projects automatically get updates
git submodule update --remote
```

## Documentation Maintenance

### Update Process

```
1. Detect pattern during development
   ↓
2. Document in project's conventions-tracking.md
   ↓
3. Create/update wiki page
   ↓
4. Submit PR with documentation changes
   ↓
5. Review and merge
   ↓
6. GitHub Actions auto-syncs to wiki
   ↓
7. Documentation available everywhere
```

### Governance

**Who Can Update**:
- Anyone can propose via PR
- Team leads review major changes
- Auto-sync ensures consistency

**When to Update**:
- New pattern emerges
- Existing pattern evolves
- Exceptions discovered
- Better examples found

**Versioning**:
- Git tags for major documentation releases
- Changelog for significant changes
- Evolution history in each page

## Link Management

### Internal Wiki Links

```markdown
# From Conventions/Git-Workflow.md

See also [Naming Conventions](../Conventions/Naming-Conventions.md)
See also [Lambda Patterns](../TypeScript/Lambda-Function-Patterns.md)
```

### External Links

```markdown
# Official specifications
See [Conventional Commits](https://www.conventionalcommits.org/)

# GitHub repository
See [Issue Tracker](https://github.com/user/repo/issues)
```

### Link Transformation for GitHub Wiki

GitHub Actions sync script transforms links:

```bash
# In docs/wiki/ (source)
[Naming](docs/wiki/Conventions/Naming-Conventions.md)

# In GitHub Wiki (synced)
[Naming](Conventions/Naming-Conventions)
```

Auto-transformation removes `docs/wiki/` prefix and `.md` extension.

## Convention Evolution Pattern

### Lifecycle

```
1. Pattern Emerges
   ↓ (Convention Capture System)
2. Tracked in conventions-tracking.md
   ↓ (Verification & Discussion)
3. Documented in wiki
   ↓ (Usage & Feedback)
4. Refined based on experience
   ↓ (Continuous Improvement)
5. Pattern becomes standard
```

### Documentation Updates

Track evolution in each wiki page:

```markdown
## Evolution History

- **2025-11-22**: Initial detection during code review
- **2025-11-25**: Added exception for legacy code
- **2025-12-01**: Refined based on team feedback
- **2025-12-15**: Added automation enforcement
```

## Best Practices

### Do's

✅ Use passthrough files for tool compatibility
✅ Maintain single source of truth
✅ Reference wiki instead of duplicating
✅ Auto-sync to GitHub Wiki
✅ Version control all documentation
✅ Include evolution history
✅ Link between related patterns
✅ Use standard page template

### Don'ts

❌ Duplicate content across files
❌ Edit GitHub Wiki directly (edit docs/wiki/)
❌ Create documentation silos
❌ Skip cross-references
❌ Leave broken links
❌ Ignore documentation debt
❌ Create tool-specific forks

## Common Patterns

### Redirect Pattern

```markdown
# Old Location: docs/OLD-GUIDE.md

This guide has moved to the wiki.

See [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) for current documentation.
```

### Deprecation Pattern

```markdown
# [Deprecated Pattern Name]

⚠️ **DEPRECATED**: This pattern is no longer recommended.

Use [Error Handling Pattern](../TypeScript/Error-Handling.md) instead.

## Migration Guide
[How to migrate from old to new pattern...]
```

### Work In Progress Pattern

```markdown
# [Pattern Name] (WIP)

🚧 **WORK IN PROGRESS**: This documentation is incomplete.

## Status
- [x] Core concept documented
- [ ] Examples needed
- [ ] Enforcement strategy pending
- [ ] Related patterns to be linked

## Contributing
[How others can help complete this documentation...]
```

## Automation

### Link Checker

```bash
#!/bin/bash
# Check for broken wiki links

# Find markdown files with links
find docs/wiki -name "*.md" | while read file; do
  # Extract and verify each link
  # Using double quotes to prevent pattern interpretation
  grep -o '\[[^]]*\]([^)]*\.md)' "$file" 2>/dev/null | while read link; do
    target=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
    if [ ! -f "docs/wiki/$target" ]; then
      echo "Broken link in $file: $target"
    fi
  done
done
```

### Sidebar Generation

```bash
# Auto-generate navigation sidebar
bash .github/scripts/generate-sidebar.sh
```

### Wiki Sync

```bash
# Sync docs/wiki/ to GitHub Wiki
bash .github/scripts/sync-wiki.sh
```

## Related Documentation

- [AI Tool Context Files](AI-Tool-Context-Files.md) - AGENTS.md and passthroughs
- [Convention Capture System](Convention-Capture-System.md) - How patterns are captured
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Effective collaboration

---

*Use passthrough files to maintain compatibility while keeping a single source of truth. Auto-sync documentation to make it accessible in multiple formats. Follow standard templates for consistency.*