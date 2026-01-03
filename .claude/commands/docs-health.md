# Documentation Health Check

Comprehensive validation of all documentation: wiki, TypeDoc, Terraform docs, and internal links.

## Quick Start

```bash
# Usage: /docs-health
# Or with auto-fix: /docs-health --fix
```

## Workflow

### Step 1: Validate Script Registry

```bash
pnpm run validate:docs
```

Checks that all scripts in `package.json` are documented.

### Step 2: Check Wiki Structure

```
MCP Tool: query_conventions
Query: wiki
```

Validates wiki pages follow structure conventions.

### Step 3: Verify TypeDoc Currency

```bash
# Check if TypeDoc is current
SOURCE_MTIME=$(stat -f %m src/lambdas/*/src/index.ts | sort -rn | head -1)
DOC_MTIME=$(stat -f %m docs/api/index.html 2>/dev/null || echo 0)

if [ "$SOURCE_MTIME" -gt "$DOC_MTIME" ]; then
  echo "WARNING: TypeDoc is stale - source files newer than docs"
fi
```

### Step 4: Check Terraform Docs

```bash
# Verify terraform-docs output is current
cd terraform
terraform-docs markdown . > /tmp/tf-docs-current.md
diff -q /tmp/tf-docs-current.md README.md || echo "WARNING: Terraform docs outdated"
```

### Step 5: Find Orphaned Documentation

```bash
# Find references to non-existent files
grep -roh 'src/[a-zA-Z0-9/_.-]*' docs/wiki/ | sort -u | while read ref; do
  if [ ! -e "$ref" ]; then
    echo "ORPHANED: $ref"
  fi
done
```

### Step 6: Validate Internal Links

```bash
# Check markdown links
grep -roh '\[.*\]([^)]*\.md)' docs/wiki/ | while read link; do
  target=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
  if [ ! -f "docs/wiki/$target" ]; then
    echo "BROKEN LINK: $link"
  fi
done
```

### Step 7: Check Convention Coverage

```
MCP Tool: query_conventions
Query: list
```

Verify all documented conventions have corresponding wiki pages.

### Step 8: Verify AGENTS.md Accuracy

Cross-reference AGENTS.md with actual codebase:
- Lambda list matches `src/lambdas/`
- Entity list matches `src/entities/`
- MCP tools match `src/mcp/handlers/`

---

## Output Format

```markdown
## Documentation Health Report

### Summary

| Category | Status | Issues |
|----------|--------|--------|
| Script Registry | OK | 0 |
| Wiki Structure | WARN | 2 |
| TypeDoc | STALE | 1 |
| Terraform Docs | OK | 0 |
| Orphaned Refs | WARN | 3 |
| Broken Links | CRITICAL | 1 |
| Conventions | OK | 0 |
| AGENTS.md | WARN | 2 |

**Overall Health**: 78% (needs attention)

### Critical Issues (1)

#### Broken Link in API.md

**File**: docs/wiki/API/Authentication.md:45
**Link**: `[See handler](../Lambdas/OldAuth.md)`
**Status**: Target file does not exist

**Fix**: Update link to correct file or remove reference.

### Warnings (7)

#### Stale TypeDoc

TypeDoc was last generated 5 days ago. Source files have been modified since.

**Fix**:
```bash
pnpm run document-source
```

#### Orphaned References (3)

| File | Line | Reference |
|------|------|-----------|
| docs/wiki/Lambdas/Overview.md | 23 | src/lambdas/OldLambda/src/index.ts |
| docs/wiki/Entities/Users.md | 45 | src/entities/Users.ts |
| docs/wiki/API/Files.md | 67 | src/types/old-types.ts |

**Fix**: Update or remove references to deleted files.

#### AGENTS.md Drift (2)

| Section | Issue |
|---------|-------|
| Lambda Table | Missing: CleanupExpiredRecords |
| Entity Table | Missing: VerificationTokens |

**Fix**: Update AGENTS.md tables.

### Validation Details

#### Script Registry: OK
All 72 npm scripts are documented.

#### Wiki Structure: WARN
- Missing: docs/wiki/Lambdas/CleanupExpiredRecords.md
- Missing: docs/wiki/Testing/Integration-Patterns.md

#### Convention Coverage: OK
All 19 conventions have wiki documentation.

### Auto-Fix Available

The following can be auto-fixed:

- [ ] Regenerate TypeDoc: `pnpm run document-source`
- [ ] Regenerate Terraform docs: `pnpm run document-terraform`
- [ ] Update AGENTS.md Lambda table

Run with `--fix` to apply auto-fixes.

### Manual Fixes Required

- [ ] Update broken link in Authentication.md
- [ ] Remove orphaned references
- [ ] Create missing wiki pages

### Recommendations

1. Add documentation health check to CI
2. Regenerate docs after each merge to master
3. Review wiki quarterly for accuracy
```

---

## Human Checkpoints

1. **Review critical issues** - Must fix broken links
2. **Approve auto-fixes** - Before applying
3. **Prioritize manual fixes** - Which to address now vs later

---

## Auto-Fix Mode

With `--fix` flag:

```bash
/docs-health --fix
```

Automatically:
1. Regenerates TypeDoc
2. Regenerates Terraform docs
3. Updates AGENTS.md tables (simple cases)

Does NOT auto-fix:
- Broken links (requires judgment)
- Orphaned references (might be intentional)
- Missing wiki pages (needs content)

---

## CI Integration

Add to `.github/workflows/docs-health.yml`:

```yaml
name: Documentation Health
on:
  push:
    branches: [master]
    paths:
      - 'docs/**'
      - 'src/**/*.ts'
      - 'terraform/*.tf'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check TypeDoc Currency
        run: |
          pnpm run document-source
          git diff --exit-code docs/api/

      - name: Check Terraform Docs
        run: |
          cd terraform
          terraform-docs markdown . > /tmp/tf-docs.md
          diff -q /tmp/tf-docs.md README.md

      - name: Check Wiki Links
        run: pnpm run validate:docs
```

---

## Regeneration Commands

```bash
# All documentation
pnpm run cleanup

# TypeDoc only
pnpm run document-source

# Terraform docs only
pnpm run document-terraform

# API docs (OpenAPI)
pnpm run document-api

# LLM context files
pnpm run generate:llms
```

---

## Notes

- Run after significant code changes
- Keep TypeDoc current with source
- Broken links degrade developer experience
- AGENTS.md accuracy affects AI agent effectiveness
