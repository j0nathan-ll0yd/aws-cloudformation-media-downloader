# GraphRAG Automation

The GraphRAG knowledge graph automatically stays synchronized with source code changes through GitHub Actions.

## Overview

GraphRAG provides semantic memory for AI agents working on this codebase. The automation ensures the knowledge graph is always current with the latest code structure.

## How It Works

```
Source Code Change → GitHub Actions → GraphRAG Extraction → Knowledge Graph Update
```

### Trigger Files

The workflow runs when these files change:
- `src/lambdas/**` - Lambda function changes
- `src/entities/**` - Entity definition changes
- `src/lib/vendor/**` - Vendor wrapper changes
- `graphrag/metadata.json` - Manual metadata updates
- `tsp/**` - TypeSpec API changes

### Workflow File

`.github/workflows/auto-update-graphrag.yml`

```yaml
name: Auto-Update GraphRAG
on:
  push:
    branches: [master]
    paths:
      - 'src/lambdas/**'
      - 'src/entities/**'
      - 'src/lib/vendor/**'
      - 'graphrag/metadata.json'
      - 'tsp/**'

jobs:
  update-graphrag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run graphrag:extract
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: auto-update GraphRAG knowledge graph'
          file_pattern: 'graphrag/knowledge-graph.json'
```

## GraphRAG Components

### Metadata Source

`graphrag/metadata.json` contains semantic information that can't be extracted from code:

```json
{
  "lambdas": {
    "StartFileUpload": {
      "trigger": "lambda-invoke",
      "purpose": "Downloads YouTube videos to S3",
      "invokes": []
    }
  },
  "lambdaInvocations": [
    {"from": "FileCoordinator", "to": "StartFileUpload"}
  ]
}
```

### Knowledge Graph Output

`graphrag/knowledge-graph.json` is the generated output combining:
- Code structure analysis (ts-morph)
- Semantic metadata (metadata.json)
- Dependency relationships (graph.json)

## Manual Updates

When adding new components:

1. **Add Lambda**: Update `metadata.json` with trigger type and purpose
2. **Add Invocation**: Add to `lambdaInvocations` array
3. **Commit**: GraphRAG will auto-update on push

```bash
# Manually regenerate (optional)
pnpm run graphrag:extract

# Validate knowledge graph is current
pnpm run validate:doc-sync
```

## Validation

CI validates that the knowledge graph matches source:

```bash
# Runs in CI
pnpm run validate:doc-sync

# Checks:
# - Entity count matches src/entities/
# - Lambda count matches src/lambdas/
# - MCP rule count matches src/mcp/validation/rules/
```

## Benefits

1. **Always Current**: No manual sync required
2. **AI-Ready**: Agents have accurate semantic context
3. **Validated**: CI catches stale documentation
4. **Traceable**: Changes are committed with clear history

## Troubleshooting

### Stale Knowledge Graph

```bash
# Regenerate locally
pnpm run graphrag:extract

# Commit the update
git add graphrag/knowledge-graph.json
git commit -m "chore: update GraphRAG knowledge graph"
```

### CI Failure

If CI reports knowledge graph mismatch:

1. Pull latest master
2. Run `pnpm run graphrag:extract`
3. Commit and push the updated knowledge graph
