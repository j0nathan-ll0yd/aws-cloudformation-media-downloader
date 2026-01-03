# Documentation Validation

This page documents the documentation validation system that prevents drift between code and documentation.

## Overview

The project uses multiple validators to ensure documentation stays synchronized:

| Validator | Command | Purpose |
|-----------|---------|---------|
| validate-docs.sh | `pnpm run validate:docs` | Scripts in docs exist in package.json |
| validate-doc-sync.sh | `pnpm run validate:doc-sync` | Code/doc sync (9 checks) |
| validate-graphrag.sh | `pnpm run validate:graphrag` | Knowledge graph freshness |
| validate-docs-freshness.sh | `pnpm run validate:docs-freshness` | Generated docs freshness |
| validateApiPaths.ts | `pnpm run validate:api-paths` | TypeSpec/API Gateway alignment |
| MCP validation | `pnpm run validate:conventions` | Source-level doc conventions |

## Validation Checks

### validate-doc-sync.sh (9 Checks)

1. **Entity query file count** - `src/entities/queries/` matches AGENTS.md
2. **Lambda count** - `src/lambdas/` matches trigger table
3. **MCP rule count** - Rules registered match file count
4. **Documented paths** - All paths in AGENTS.md exist
5. **Stale patterns** - No Prettier refs, correct vendor paths
6. **GraphRAG metadata** - All entities in metadata.json
7. **Wiki links** - All internal markdown links resolve
8. **docs/ structure** - Markdown in wiki/, machine files in root
9. **TypeSpec coverage** - API Lambdas have TypeSpec definitions

### validate-docs-freshness.sh (3 Checks)

1. **TSDoc freshness** - `docs/source/` is newer than `src/`
2. **OpenAPI freshness** - `docs/api/` is newer than `tsp/`
3. **Terraform freshness** - `docs/terraform.md` is newer than `terraform/`

### MCP Validation Rules

| Rule | What It Validates |
|------|-------------------|
| doc-sync.ts | Import patterns match docs |
| comment-conventions.ts | JSDoc on public APIs |
| docs-structure.ts | docs/ directory organization |

## CI Integration

All validators run in the GitHub Actions `validate` job before tests:

```yaml
# .github/workflows/unit-tests.yml
validate:
  steps:
    - name: Validate documented scripts exist
      run: ./bin/validate-docs.sh
    - name: Validate documentation sync
      run: pnpm run validate:doc-sync
    - name: Validate docs freshness
      run: pnpm run validate:docs-freshness
```

The `lint-and-types` job also runs ShellCheck:

```yaml
lint-and-types:
  steps:
    - name: Run ShellCheck
      run: pnpm run lint:bash
```

## Local Validation

Run all validators locally before pushing:

```bash
# Quick check
pnpm run validate:docs
pnpm run validate:doc-sync
pnpm run validate:docs-freshness

# Or use the full local CI runner
pnpm run ci:local
```

## Adding New Validators

1. Create script in `bin/validate-*.sh`
2. Add to `package.json` scripts
3. Add to `bin/ci-local.sh` (update step count)
4. Add to `.github/workflows/unit-tests.yml` validate job
5. Update this wiki page

## Regenerating Documentation

When validators report stale docs:

```bash
# TSDoc (source API documentation)
pnpm run document-source

# OpenAPI (from TypeSpec)
pnpm run document-api

# Terraform docs
pnpm run document-terraform

# Or regenerate all with cleanup
pnpm run cleanup
```
