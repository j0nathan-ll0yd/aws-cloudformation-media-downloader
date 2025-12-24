# Documentation Structure Convention

This document defines the structure and organization of the `docs/` directory.

## Directory Organization

| Directory | Purpose | File Types | Committed |
|-----------|---------|------------|-----------|
| `docs/wiki/` | Human-readable documentation | `.md` | Yes |
| `docs/api/` | API specifications | `.yaml`, `.html` | Yes |
| `docs/` (root) | Machine-readable config files | `.json`, `.txt` | Yes |
| `docs/source/` | Generated TSDoc | `.html`, `.js` | No (gitignored) |

## Rules

### 1. All Markdown Documentation Goes in `docs/wiki/`

- Organized by topic: AWS/, Testing/, TypeScript/, MCP/, Meta/, etc.
- Synced to GitHub Wiki automatically via GitHub Actions
- Use descriptive file names with PascalCase (e.g., `Lambda-Function-Patterns.md`)

**Examples:**
- Style guides → `docs/wiki/Conventions/`
- Testing patterns → `docs/wiki/Testing/`
- AWS integration → `docs/wiki/AWS/`
- Project meta → `docs/wiki/Meta/`

### 2. Machine/Config Files Stay in `docs/` Root

Files that are consumed by tools rather than humans:

| File | Purpose |
|------|---------|
| `llms.txt` | AI crawler index (GPTBot, Perplexity) |
| `doc-code-mapping.json` | Validation config for `bin/validate-doc-sync.sh` |
| `doc-code-mapping.schema.json` | JSON schema for mapping file |

### 3. API Specifications in `docs/api/`

| File | Purpose |
|------|---------|
| `openapi.yaml` | TypeSpec-generated OpenAPI 3.0 specification |
| `index.html` | SwaggerUI for interactive API documentation |

### 4. No Archived Plans in `docs/`

- **Completed plans are deleted** - History lives in git commits and PRs
- **Active implementation plans** belong in Linear tickets, not the filesystem
- If you need to reference old work, use `git log` or search closed PRs

### 5. Generated Files Are Gitignored

| Directory/File | Purpose |
|----------------|---------|
| `docs/source/` | TSDoc-generated API documentation |
| `docs/llms-full.txt` | Concatenated docs for AI agents |

These can be regenerated on demand with:
```bash
pnpm run document-source  # Regenerate TSDoc
pnpm run generate:llms    # Regenerate llms-full.txt
```

## Current Structure

```
docs/
├── api/
│   ├── openapi.yaml           # TypeSpec-generated OpenAPI
│   └── index.html             # SwaggerUI
├── wiki/                      # ALL human-readable docs
│   ├── AWS/                   # AWS integration patterns
│   ├── Conventions/           # Code style and conventions
│   ├── Infrastructure/        # OpenTofu/Terraform patterns
│   ├── Integration/           # LocalStack, testing infrastructure
│   ├── MCP/                   # Model Context Protocol tools
│   ├── Meta/                  # Project meta documentation
│   ├── Testing/               # Testing patterns and guides
│   └── TypeScript/            # TypeScript patterns
├── doc-code-mapping.json      # Validation config
├── doc-code-mapping.schema.json
└── llms.txt                   # AI crawler index
```

## Adding New Documentation

1. **Determine the topic category** (Testing, AWS, TypeScript, etc.)
2. **Create the file in `docs/wiki/{Category}/`**
3. **Use PascalCase with hyphens** for the filename (e.g., `New-Feature-Guide.md`)
4. **Add cross-references** to related wiki pages
5. **Update AGENTS.md** if the new doc describes a critical convention

## Migration Notes

This structure was established in December 2024 to:
- Consolidate all human-readable docs in one location (`docs/wiki/`)
- Eliminate stale archived content (history preserved in git)
- Separate machine-readable configs from documentation
- Leverage GitHub Wiki sync for beautiful web UI

Previous locations (now deprecated):
- `docs/conventions-tracking.md` → `docs/wiki/Meta/Conventions-Tracking.md`
- `docs/MCP-*.md` → `docs/wiki/MCP/*.md`
- `docs/Test-Scaffolding.md` → `docs/wiki/Testing/Test-Scaffolding.md`
- `docs/archive/` → Deleted (history in git)
