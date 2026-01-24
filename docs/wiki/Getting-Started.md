# Getting Started with the Development Wiki

This guide helps you understand and use this development conventions wiki effectively.

## Hands-On Tutorials

Learn by doing with these step-by-step tutorials:

- **[Tutorial: Create Your First Lambda](Getting-Started/Tutorial-First-Lambda.md)** - Build a complete Lambda function from scratch, including handler implementation, tests, and infrastructure

## What Is This Wiki?

This is a **centralized knowledge base** of development conventions, patterns, and best practices that apply across TypeScript/AWS projects. It represents institutional knowledge captured over time through the Convention Capture System.

### Key Characteristics
- **Universal patterns** - Conventions that work across multiple projects
- **Git-tracked** - Version controlled in `docs/wiki/` directory
- **Auto-synced** - Automatically published to GitHub Wiki for web viewing
- **Continuously updated** - New conventions added as they emerge
- **AI-compatible** - Referenced by AGENTS.md for AI assistants

## How to Navigate

### By Category
The wiki is organized into logical categories:
- **Conventions** - Universal coding standards
- **TypeScript** - Language-specific patterns
- **Testing** - Test strategies and mocking
- **AWS** - Cloud service patterns
- **Bash** - Shell scripting standards
- **Infrastructure** - IaC patterns
- **Methodologies** - Development philosophies
- **Meta** - Documentation about documentation

### By Priority
Look for enforcement levels:
- 🚨 **Zero-tolerance** - NO exceptions allowed
- ⚠️ **Required** - Must follow unless justified
- 📋 **Recommended** - Should follow for consistency
- 💡 **Optional** - Consider for specific cases

### By Search
- Use your IDE's file search in `docs/wiki/`
- Use GitHub Wiki search (once synced)
- grep for specific patterns

## How to Use in Your Project

### Step 1: Set Up AGENTS.md
Create an AGENTS.md file in your project root with:
```markdown
# Project Context for AI Agents

## Convention Capture System
[Copy from template - includes detection patterns]

## Project Overview
[Your project-specific content]

## Wiki Conventions to Follow
[Links to relevant wiki pages]
```

### Step 2: Create Passthrough Files
For tool compatibility:

**CLAUDE.md:**
```
@AGENTS.md
```

**GEMINI.md:**
```markdown
# See AGENTS.md
This project uses AGENTS.md as the single source of truth.
Please see AGENTS.md for documentation.
```

### Step 3: Reference Wiki Pages
From your AGENTS.md or documentation:
```markdown
## Conventions to Follow
- [Naming](Conventions/Naming-Conventions.md)
- [AWS SDK](Conventions/Vendor-Encapsulation-Policy.md)
- [Testing](Testing/Vitest-Mocking-Strategy.md)
```

### Step 4: Track Project Conventions
Create `docs/wiki/Meta/Conventions-Tracking.md` for project-specific patterns:
```markdown
## Project-Specific Conventions

### Detected: 2025-11-22
1. **Pattern Name**
   - What: [Description]
   - Why: [Rationale]
   - Status: ✅ Documented
```

## Understanding Convention Pages

Each wiki page follows a standard template:

### Page Structure
```markdown
# [Pattern Name]

## Quick Reference
- **When to use**: [One-line]
- **Enforcement**: [Level]
- **Impact if violated**: [High/Medium/Low]

## The Rule
[Clear statement]

## Examples
### ✅ Correct
[Good example]

### ❌ Incorrect
[Bad example]

## Rationale
[Why this exists]

## Enforcement
[How to check/automate]

## Related Patterns
[Links to related pages]
```

### Reading Priority
1. **Quick Reference** - Get the essence
2. **The Rule** - Understand the requirement
3. **Examples** - See it in practice
4. **Enforcement** - Know how it's checked

## For AI Assistants

### Starting a Session
1. Read AGENTS.md (which references this wiki)
2. Check `docs/wiki/Meta/Conventions-Tracking.md` for project patterns
3. Activate convention detection mode
4. Reference wiki pages as needed

### During Development
- Follow wiki patterns by default
- Flag new conventions when detected
- Update Emerging Conventions log
- Reference wiki pages in explanations

### Example AI Usage
```
User: "How should I handle AWS SDK imports?"

AI: Per [AWS SDK Encapsulation Policy](Conventions/Vendor-Encapsulation-Policy.md),
NEVER import AWS SDK directly. Use vendor wrappers in lib/vendor/AWS/.

This is a zero-tolerance rule to maintain encapsulation and testability.
```

## For Developers

### Finding Patterns
1. Check relevant category in wiki
2. Search for keywords
3. Review enforcement level
4. Follow examples

### Contributing New Patterns
1. Detect pattern emergence
2. Document in `docs/wiki/Meta/Conventions-Tracking.md`
3. Create wiki page following template
4. Submit PR with:
   - Clear rationale
   - Good/bad examples
   - Enforcement strategy
5. Update Home.md navigation

### Reporting Issues
- Missing pattern? Create issue
- Unclear documentation? Suggest edit
- Conflicting patterns? Raise for discussion

## Common Use Cases

### Starting New Project
1. Copy AGENTS.md template
2. Add project-specific content
3. Link to relevant wiki pages
4. Create `docs/wiki/Meta/Conventions-Tracking.md`

### Onboarding Developer
1. Point to wiki Home.md
2. Highlight zero-tolerance rules
3. Show project's AGENTS.md
4. Explain Convention Capture

### Code Review
1. Reference wiki for standards
2. Link to specific patterns
3. Check enforcement level
4. Suggest wiki updates if needed

### Debugging Test Failures
1. Check [Vitest Mocking Strategy](Testing/Vitest-Mocking-Strategy.md)
2. Review transitive dependencies
3. Follow 7-step checklist
4. Mock all module-level imports

## Automation & Sync

### Local Files
- Edit in `docs/wiki/` directory
- Commit via normal git workflow
- Review via pull requests

### GitHub Wiki Sync
- Automatic on merge to master
- GitHub Actions workflow
- ~30 second delay
- Creates web-friendly view

### Benefits
- **Developers** - Edit in IDE
- **Users** - Browse on web
- **Automation** - Zero maintenance
- **Version Control** - Full git history

## Best Practices

### Do's
✅ Reference wiki pages in code comments
✅ Update wiki when patterns evolve
✅ Use Convention Capture System
✅ Follow zero-tolerance rules strictly
✅ Link from AGENTS.md

### Don'ts
❌ Duplicate wiki content in projects
❌ Ignore zero-tolerance rules
❌ Create conflicting local patterns
❌ Skip convention detection
❌ Edit GitHub Wiki directly (edit docs/wiki/)

## Quick Commands

### Search Wiki
```bash
# Find all zero-tolerance rules
grep -r "Zero-tolerance" docs/wiki/

# Find AWS patterns
ls docs/wiki/AWS/

# Search for specific pattern
grep -r "camelCase" docs/wiki/
```

### Validate Links
```bash
# Check for broken wiki links
find docs/wiki -name "*.md" -exec grep -l "](.*)" {} \;
```

### View Recent Changes
```bash
# See recent wiki updates
git log --oneline docs/wiki/ | head -10
```

## Troubleshooting

### Can't Find Pattern?
1. Search by keyword
2. Check multiple categories
3. Review Emerging Conventions
4. Ask in team chat
5. Create if truly missing

### Conflicting Patterns?
1. Check enforcement levels
2. Project-specific overrides project
3. Zero-tolerance always wins
4. Raise for team discussion

### Wiki Not Syncing?
1. Check GitHub Actions status
2. Verify wiki enabled in settings
3. Check workflow permissions
4. Manual trigger if needed

## Next Steps

1. **Explore** - Browse categories that interest you
2. **Apply** - Use patterns in your code
3. **Contribute** - Add missing patterns
4. **Detect** - Flag emerging conventions
5. **Evolve** - Improve existing patterns

---

*Remember: This wiki is a living document. It grows through the Convention Capture System and represents the project's collective knowledge. Use it, improve it, and help it evolve.*