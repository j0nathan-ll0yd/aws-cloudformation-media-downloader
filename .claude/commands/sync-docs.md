# Documentation Sync

Detect documentation drift and synchronize wiki pages, metadata, and TSDoc with the codebase.

## Quick Start

```bash
# Check for documentation drift
pnpm run graphrag:extract

# Generate LLM context files
pnpm run generate:llms
```

## Workflow

### Step 1: Detect New ComponentsYes

Scan for Lambdas and Entities not in metadata:

```bash
# Get all Lambda directories
LAMBDAS=$(ls -d src/lambdas/*/ 2>/dev/null | xargs -I {} basename {})

# Get Lambdas in metadata
DOCUMENTED=$(cat graphrag/metadata.json | jq -r '.lambdas[].name')

# Find undocumented
for lambda in $LAMBDAS; do
  if ! echo "$DOCUMENTED" | grep -q "^$lambda$"; then
    echo "UNDOCUMENTED: $lambda"
  fi
done
```

Similarly check for:
- New entities in `src/entities/`
- New MCP handlers in `src/mcp/handlers/`
- New utility modules in `util/`

### Step 2: Compare TSDoc with Wiki

For each Lambda, verify documentation alignment:

| Source | Location | Purpose |
|--------|----------|---------|
| TSDoc | `src/lambdas/*/src/index.ts` | Code-level documentation |
| Wiki | `docs/wiki/Lambdas/[Name].md` | Detailed guide |
| Metadata | `graphrag/metadata.json` | AI context |
| AGENTS.md | `AGENTS.md` | Quick reference |

Check for drift:
- TSDoc describes different behavior than wiki
- Wiki references outdated parameters
- Metadata missing trigger type or dependencies

### Step 3: Identify Orphaned References

Find documentation pointing to non-existent code:

```bash
# Extract all file references from wiki
grep -roh 'src/[a-zA-Z0-9/_.-]*' docs/wiki/ | sort -u > /tmp/wiki-refs.txt

# Check which don't exist
while read ref; do
  if [ ! -e "$ref" ]; then
    echo "ORPHANED: $ref"
  fi
done < /tmp/wiki-refs.txt
```

### Step 4: Generate Missing Documentation

For undocumented components, generate documentation:

#### Lambda Documentation

```markdown
# [LambdaName]

## Overview

[Brief description from TSDoc or handler logic]

## Trigger

- **Type**: [API Gateway | S3 Event | SQS | CloudWatch Schedule]
- **Source**: [Endpoint path or event source]

## Input

\`\`\`typescript
interface [LambdaName]Input {
  // From handler signature or Zod schema
}
\`\`\`

## Output

\`\`\`typescript
interface [LambdaName]Response {
  // From return type
}
\`\`\`

## Dependencies

- Entities: [List of entities accessed]
- AWS Services: [S3, DynamoDB, etc.]
- External: [Third-party APIs]

## Error Handling

| Error | Status Code | Description |
|-------|-------------|-------------|
| ValidationError | 400 | Invalid input |
| NotFoundError | 404 | Resource not found |
| InternalError | 500 | Unexpected error |

## Related

- [Link to related Lambdas]
- [Link to entity documentation]
```

#### Entity Documentation

```markdown
# [EntityName]

## Schema

\`\`\`typescript
// From Drizzle schema
\`\`\`

## Relationships

- [Related entities and join conditions]

## Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | id | Unique lookup |
| GSI1 | userId | User's records |

## Access Patterns

- Get by ID
- Query by user
- [Other access patterns]
```

### Step 5: Update Metadata

Update `graphrag/metadata.json` with new components:

```json
{
  "lambdas": [
    {
      "name": "NewLambda",
      "trigger": "API Gateway",
      "path": "POST /new-endpoint",
      "entities": ["Users", "Files"],
      "purpose": "Handle new functionality"
    }
  ]
}
```

### Step 6: Regenerate GraphRAG

After updates, regenerate the knowledge graph:

```bash
pnpm run graphrag:extract
```

Verify:
- No orphaned references
- All Lambdas have entries
- Relationships are accurate

### Step 7: Update LLM Context Files

Regenerate context files for AI agents:

```bash
# Full docs for AI agents
pnpm run generate:llms

# Pack codebase context
pnpm run pack:context
```

## Drift Detection Rules

### CRITICAL - Must Fix

| Issue | Detection | Fix |
|-------|-----------|-----|
| Lambda without metadata | Not in `metadata.json` | Add entry |
| Broken wiki links | Reference to deleted file | Update or remove |
| AGENTS.md outdated | New Lambda not listed | Update table |

### HIGH - Should Fix

| Issue | Detection | Fix |
|-------|-----------|-----|
| TSDoc mismatch | Different from wiki | Synchronize |
| Missing wiki page | Lambda exists, no wiki | Generate page |
| Stale examples | Code examples don't compile | Update examples |

### MEDIUM - Recommended

| Issue | Detection | Fix |
|-------|-----------|-----|
| Missing TSDoc | Export without docs | Add JSDoc comments |
| Sparse wiki page | < 50 words | Expand documentation |
| Outdated screenshots | Reference old UI | Update images |

## Automation

### Post-Merge Hook

After PRs merge to master, run sync check:

```yaml
name: Documentation Sync
on:
  push:
    branches: [master]
    paths:
      - 'src/lambdas/**'
      - 'src/entities/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Documentation Drift
        run: |
          pnpm run graphrag:extract
          git diff --exit-code graphrag/

      - name: Create Issue on Drift
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Documentation drift detected',
              body: 'GraphRAG metadata is out of sync with codebase.'
            })
```

## Output Format

```markdown
## Documentation Sync Report

### Undocumented Components

| Type | Name | Priority |
|------|------|----------|
| Lambda | NewLambda | HIGH |
| Entity | NewEntity | MEDIUM |

### Orphaned References

| File | Line | Reference | Status |
|------|------|-----------|--------|
| docs/wiki/API.md | 45 | src/old/handler.ts | DELETED |

### Drift Detected

| Component | TSDoc | Wiki | Status |
|-----------|-------|------|--------|
| ListFiles | "Lists files" | "Returns files" | MISMATCH |

### Actions Taken

- [ ] Generated wiki page for NewLambda
- [ ] Updated metadata.json
- [ ] Fixed orphaned reference in API.md
- [ ] Regenerated GraphRAG

### Human Review Required

- [ ] Approve AGENTS.md updates
- [ ] Verify generated documentation accuracy
- [ ] Review breaking changes section
```

## Human Checkpoints

1. **Approve AGENTS.md changes** - affects all AI agents
2. **Review generated documentation** - may need refinement
3. **Verify wiki accuracy** - generated content needs human review
4. **Confirm auto-fixes** - before applying automatic corrections

---

## Auto-Fix Capability

For automatically correcting common documentation issues:

### Fix Orphaned References

```bash
# Find and list orphaned references
grep -roh 'src/[a-zA-Z0-9/_.-]*' docs/wiki/ | sort -u | while read ref; do
  if [ ! -e "$ref" ]; then
    echo "ORPHANED: $ref"
  fi
done
```

### Update Metadata Automatically

```
MCP Tool: query_lambda
Query: list
```

Compare output with `graphrag/metadata.json` and add missing entries.

### Regenerate Documentation

```bash
# TypeDoc for source documentation
pnpm run document-source

# Terraform documentation
pnpm run document-terraform

# API documentation from TypeSpec
pnpm run document-api
```

### Validate with MCP Tools

```
MCP Tool: query_conventions
Query: wiki
Term: [search term]
```

Search wiki for specific topics to verify coverage.

---

## Structured Validation Workflow

### Step 1: Detect Drift

```
MCP Tool: query_lambda
Query: list
```

Cross-reference against metadata.json.

### Step 2: Identify Gaps

```
MCP Tool: query_conventions
Query: list
Category: documentation
```

List all documentation conventions to check compliance.

### Step 3: Generate Fixes

For each undocumented component, generate wiki content following templates in Step 4 of the main workflow.

### Step 4: Apply Fixes

**CHECKPOINT**: Before applying:
- [ ] Review generated content
- [ ] Verify no sensitive information exposed
- [ ] Check links are valid

Apply changes and regenerate:
```bash
pnpm run graphrag:extract
pnpm run generate:llms
```

---

## Notes

- Documentation lives in `docs/wiki/` - not duplicated elsewhere
- History lives in git/PRs - wiki shows current state
- All markdown follows dprint formatting (157 char lines)
- No AI attribution in generated documentation
