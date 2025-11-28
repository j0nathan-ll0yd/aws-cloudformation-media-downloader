# Documentation Patterns

## Quick Reference
- **When to use**: Organizing documentation across projects
- **Enforcement**: Recommended - maintains consistency
- **Impact if violated**: Low - may have disorganized docs

## Passthrough File Pattern

A **passthrough file** references a canonical source, allowing multiple tools to access the same content.

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

## Passthrough Examples

### Claude Code Passthrough
**File**: `CLAUDE.md`
```markdown
@AGENTS.md
```

Claude Code reads CLAUDE.md, sees the reference, and loads AGENTS.md content.

### Gemini Code Assist Passthrough
**File**: `GEMINI.md`
```markdown
# See AGENTS.md

This project uses AGENTS.md as the single source of truth for AI coding assistant context.

Please see AGENTS.md in the repository root for comprehensive project documentation and guidelines.
```

### Documentation Wiki Passthrough
```markdown
# [Topic] Documentation

For comprehensive documentation on testing patterns, see the wiki:

- [Jest ESM Mocking Strategy](../Testing/Jest-ESM-Mocking-Strategy.md)
- [Lazy Initialization Pattern](../Testing/Lazy-Initialization-Pattern.md)

This keeps documentation centralized and avoids duplication.
```

## Wiki Organization

### Git-Based Wiki
Store wiki content in main repository for version control:

```
docs/
└── wiki/
    ├── Home.md
    ├── Conventions/
    │   ├── Naming-Conventions.md
    │   └── Git-Workflow.md
    ├── TypeScript/
    │   └── Lambda-Function-Patterns.md
    └── Meta/
        └── Documentation-Patterns.md
```

### Auto-Sync to GitHub Wiki
Use GitHub Actions to automatically sync:

```
docs/wiki/ (Git)  →  GitHub Actions  →  GitHub Wiki (Public)
Source of Truth      Auto-sync on       Beautiful UI
PR reviewed          push to master     Search enabled
```

## Page Template

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

## Related Patterns
- Link to related convention 1
- Link to related convention 2
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
/**
 * Validates user credentials
 *
 * See: docs/wiki/TypeScript/TypeScript-Error-Handling.md
 */
function validateCredentials(username: string, password: string) {
  // Implementation
}
```

### From AGENTS.md
```markdown
## Wiki Conventions to Follow

**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**

### Core Conventions
- [Git Workflow](docs/wiki/Conventions/Git-Workflow.md) - NO AI attribution
- [Naming](docs/wiki/Conventions/Naming-Conventions.md) - camelCase rules

### Language-Specific
- [Lambda](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- [Testing](docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md)
- [AWS SDK](docs/wiki/AWS/SDK-Encapsulation-Policy.md) - ZERO tolerance
```

## Multi-Project Documentation

### Shared Wiki Pattern
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
```

### Symlink Pattern
```bash
cd docs
ln -s ../../shared-conventions/wiki wiki
```

## Link Management

### Internal Wiki Links
```markdown
See also [Naming Conventions](../Conventions/Naming-Conventions.md)
See also [Lambda Patterns](../TypeScript/Lambda-Function-Patterns.md)
```

### External Links
```markdown
See [Conventional Commits](https://www.conventionalcommits.org/)
See [Issue Tracker](https://github.com/user/repo/issues)
```

## Best Practices

### Do's
✅ Use passthrough files for tool compatibility
✅ Maintain single source of truth
✅ Reference wiki instead of duplicating
✅ Auto-sync to GitHub Wiki
✅ Version control all documentation
✅ Link between related patterns
✅ Use standard page template

### Don'ts
❌ Duplicate content across files
❌ Edit GitHub Wiki directly (edit docs/wiki/)
❌ Create documentation silos
❌ Skip cross-references
❌ Leave broken links
❌ Create tool-specific forks

## Related Documentation
- [AI Tool Context Files](AI-Tool-Context-Files.md) - AGENTS.md and passthroughs
- [Convention Capture System](Convention-Capture-System.md) - How patterns are captured
- [Working with AI Assistants](Working-with-AI-Assistants.md) - Effective collaboration

---

*Use passthrough files to maintain compatibility while keeping a single source of truth. Auto-sync documentation to make it accessible in multiple formats.*
