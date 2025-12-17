# GitHub Wiki Sync Automation

## Quick Reference
- **When to use**: Maintaining project documentation
- **Enforcement**: Automated via GitHub Actions
- **Impact if violated**: N/A - fully automated

## Overview

The GitHub Wiki sync automation provides the best of both worlds:
- **Git-tracked source** - Documentation in `docs/wiki/` is version controlled
- **Beautiful web UI** - GitHub Wiki provides excellent browsing experience
- **Zero manual maintenance** - Automatic sync within 30 seconds of merge

## How It Works

### Directory Structure
```
docs/
└── wiki/                        # Source of truth (version controlled)
    ├── Home.md                  # Wiki homepage
    ├── Getting-Started.md       # Quick start guide
    ├── AWS/                     # Category folders
    │   ├── CloudWatch-Logging.md
    │   └── Lambda-Environment-Variables.md
    ├── Testing/
    │   ├── Jest-ESM-Mocking-Strategy.md
    │   └── Coverage-Philosophy.md
    └── ...
```

### Sync Process
1. Developer edits markdown files in `docs/wiki/`
2. Creates PR with documentation changes
3. PR gets reviewed and merged to master
4. GitHub Actions workflow triggers automatically
5. Wiki updates within 30 seconds

## GitHub Actions Workflow

### Trigger Conditions
```yaml
on:
  push:
    branches: [master, main]
    paths:
      - 'docs/wiki/**'
      - '.github/scripts/sync-wiki.sh'
      - '.github/scripts/generate-sidebar.sh'
      - '.github/workflows/sync-wiki.yml'
```

### Key Implementation Details

#### Flat Namespace Requirement
GitHub Wiki requires **all pages at root level** (no subdirectories):

```bash
# Source structure (organized by category)
docs/wiki/AWS/CloudWatch-Logging.md
docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md

# Wiki structure (flat)
wiki/CloudWatch-Logging.md
wiki/Jest-ESM-Mocking-Strategy.md
```

#### Sidebar Generation
The sidebar (_Sidebar.md) is generated from source structure:
```bash
# Reads from categorized source
SOURCE_DIR=main/docs/wiki

# Writes flat links to wiki
[CloudWatch Logging](CloudWatch-Logging)  # No path prefix
```

#### Link Transformation
Internal links are automatically transformed (path removed, extension stripped):
```markdown
# In source file
[See Error Handling](../TypeScript/Error-Handling.md)

# After transformation in wiki
[See Error Handling](Error-Handling)
```

## Scripts

### sync-wiki.sh
- Flattens directory structure
- Transforms internal links
- Handles special files (Home.md, _Sidebar.md, _Footer.md)

### generate-sidebar.sh
- Reads source directory structure
- Creates categorized navigation
- Generates flat links for GitHub Wiki

## Adding New Documentation

### Creating a New Page
```bash
# 1. Create markdown file in appropriate category
echo "# My New Feature" > docs/wiki/Testing/My-New-Feature.md

# 2. Add content
vim docs/wiki/Testing/My-New-Feature.md

# 3. Commit and push
git add docs/wiki/
git commit -m "docs: add My New Feature documentation"
git push
```

### Creating a New Category
```bash
# 1. Create category directory
mkdir docs/wiki/MyCategory

# 2. Add first page
echo "# Category Overview" > docs/wiki/MyCategory/Overview.md

# 3. Commit (sidebar auto-updates)
git add docs/wiki/
git commit -m "docs: add MyCategory documentation"
git push
```

## File Naming

### Unique Names Required
Due to flat namespace, all files must have unique names:

```bash
# ❌ Will cause conflicts
docs/wiki/TypeScript/Error-Handling.md
docs/wiki/Bash/Error-Handling.md

# ✅ Use unique names
docs/wiki/TypeScript/TypeScript-Error-Handling.md
docs/wiki/Bash/Bash-Error-Handling.md
```

### Naming Conventions
- Use **Title-Case-With-Hyphens.md** for file names
- Match page title in file name for clarity
- Keep names descriptive but concise

## Special Files

### Home.md
- Wiki landing page
- Must exist at `docs/wiki/Home.md`
- Contains navigation overview

### _Sidebar.md
- Auto-generated, don't edit manually
- Created from source directory structure
- Updates on every sync

### _Footer.md
- Auto-generated with sync timestamp
- Shows link to source repository
- Updates on every sync

## Troubleshooting

### Wiki Not Updating
1. Check workflow runs: `gh run list --workflow=sync-wiki.yml`
2. Verify wiki is enabled in repo settings
3. Check for naming conflicts (duplicate file names)

### Broken Links
1. Ensure unique file names across categories
2. Check link transformation in sync-wiki.sh
3. Verify flat links in _Sidebar.md

### Missing Categories
1. Categories only appear if they contain .md files
2. Check SOURCE_DIR in generate-sidebar.sh
3. Verify directory structure in docs/wiki/

## Benefits

1. **Version Control** - All docs in Git with full history
2. **Code Review** - Documentation changes reviewed in PRs
3. **Automation** - No manual wiki editing needed
4. **Organization** - Category folders in source
5. **Discovery** - Beautiful GitHub Wiki UI
6. **Search** - GitHub Wiki search functionality
7. **Offline Access** - Docs available in cloned repo

## Related Patterns

- [Documentation Patterns](Documentation-Patterns.md) - Documentation standards
- [Convention Capture System](Convention-Capture-System.md) - How conventions are documented
- [AI Tool Context Files](AI-Tool-Context-Files.md) - AGENTS.md integration

---

*Automated GitHub Wiki sync provides version-controlled documentation with zero manual maintenance.*