# MCP Server CI Integration Guide

This document provides CI/CD integration patterns for the MCP server tools.

## Available MCP Tools (21 Total)

### Query Tools (14)
- `query_entities` - ElectroDB entity schemas
- `query_lambda` - Lambda configurations
- `query_infrastructure` - AWS infrastructure
- `query_dependencies` - Code dependency graph
- `query_conventions` - Project conventions
- `query_git_history` - Semantic git history

### Validation Tools (4)
- `validate_pattern` - Convention validation
- `check_coverage` - Test mock coverage
- `check_type_alignment` - TypeSpec alignment
- `validate_naming` - Type naming conventions

### Analysis Tools (5)
- `lambda_impact` - Change impact analysis
- `suggest_tests` - Test scaffolding
- `analyze_pattern_consistency` - Pattern drift detection
- `analyze_bundle_size` - Bundle size analysis
- `analyze_cold_start` - Cold start estimation

### Refactoring Tools (3)
- `refactor_rename_symbol` - Symbol renaming
- `refactor_extract_module` - Module extraction
- `refactor_inline_constant` - Constant inlining

### Migration Tools (2)
- `apply_convention` - Apply single convention
- `generate_migration` - Bulk migration generator

### Cross-Repo Tools (1)
- `sync_conventions` - Convention export/import

### Semantic Tools (2)
- `index_codebase` - Vector index update
- `search_codebase_semantics` - Semantic search

---

## CI Integration Patterns

### Pattern 1: PR Validation Pipeline

```yaml
# .github/workflows/mcp-validation.yml
name: MCP Validation
on: [pull_request]

jobs:
  breaking-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install

      - name: Check Breaking Changes
        run: |
          node src/mcp/server.ts <<EOF
          {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diff_semantic","arguments":{"query":"breaking","baseRef":"origin/master"}}}
          EOF

      - name: Validate Conventions
        run: |
          for file in $(git diff --name-only origin/master...HEAD | grep '\.ts$'); do
            node src/mcp/server.ts <<EOF
            {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"validate_pattern","arguments":{"query":"all","file":"$file"}}}
          EOF
          done

  bundle-size-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install && pnpm build

      - name: Check Bundle Sizes
        run: |
          node src/mcp/server.ts <<EOF
          {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_bundle_size","arguments":{"query":"compare","compareRef":"origin/master"}}}
          EOF
```

### Pattern 2: Scheduled Convention Enforcement

```yaml
# .github/workflows/convention-drift.yml
name: Convention Drift Check
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 9am

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install

      - name: Check Pattern Consistency
        id: drift
        run: |
          RESULT=$(node src/mcp/server.ts <<EOF
          {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_pattern_consistency","arguments":{"query":"drift"}}}
          EOF)
          echo "result=$RESULT" >> $GITHUB_OUTPUT

      - name: Create Issue for Drift
        if: contains(steps.drift.outputs.result, 'hasDrift":true')
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Pattern Drift Detected',
              body: 'Pattern consistency check detected drifts. Run `analyze_pattern_consistency` for details.'
            })
```

### Pattern 3: Auto-Fix on PR

```yaml
# .github/workflows/auto-fix.yml
name: Auto-Fix Conventions
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}

      - uses: pnpm/action-setup@v2
      - run: pnpm install

      - name: Generate Migration Plan
        id: plan
        run: |
          node src/mcp/server.ts <<EOF
          {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_migration","arguments":{"query":"plan","convention":"all"}}}
          EOF

      - name: Apply Auto-Fixable Conventions
        run: |
          # Apply AWS SDK wrapper convention (fully auto-fixable)
          for file in $(git diff --name-only origin/master...HEAD | grep '\.ts$'); do
            node src/mcp/server.ts <<EOF
            {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"apply_convention","arguments":{"file":"$file","convention":"aws-sdk-wrapper","dryRun":false}}}
          EOF
          done

      - name: Commit Fixes
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add -A
          git diff --staged --quiet || git commit -m "fix: auto-apply convention fixes"
          git push
```

### Pattern 4: Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

# Get staged TypeScript files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$')

if [ -z "$STAGED" ]; then
  exit 0
fi

# Validate each staged file
for file in $STAGED; do
  echo "Validating $file..."

  # Run MCP validation
  RESULT=$(node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"validate_pattern","arguments":{"query":"all","file":"$file"}}}
EOF)

  # Check for violations
  if echo "$RESULT" | grep -q '"valid":false'; then
    echo "Convention violations in $file"
    echo "$RESULT" | jq '.result.content[0].text | fromjson | .violations'
    exit 1
  fi
done

echo "All conventions passed"
```

---

## Tool Usage Examples

### Semantic Diff Analysis

```bash
# Check breaking changes between branches
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diff_semantic","arguments":{"query":"breaking","baseRef":"origin/master","headRef":"HEAD"}}}
EOF

# Get impact analysis
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diff_semantic","arguments":{"query":"impact","scope":"entities"}}}
EOF
```

### Convention Sync (Multi-Repo)

```bash
# Export conventions to JSON
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sync_conventions","arguments":{"query":"export","format":"json"}}}
EOF

# Diff with external source
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sync_conventions","arguments":{"query":"diff","source":"https://example.com/conventions.json"}}}
EOF
```

### Bundle Size Optimization

```bash
# Get optimization suggestions
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_bundle_size","arguments":{"query":"optimize","lambda":"WebhookFeedly"}}}
EOF

# Compare with previous version
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_bundle_size","arguments":{"query":"compare","compareRef":"HEAD~10"}}}
EOF
```

### Cold Start Analysis

```bash
# Estimate cold starts for all Lambdas
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_cold_start","arguments":{"query":"estimate"}}}
EOF

# Compare memory configurations
node src/mcp/server.ts <<EOF
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_cold_start","arguments":{"query":"compare","lambda":"ListFiles"}}}
EOF
```

---

## Auto-Fix Coverage

| Convention | Auto-Fix Level | Tool |
|------------|----------------|------|
| aws-sdk-wrapper | Full | `apply_convention` |
| electrodb-mock | Partial | `apply_convention` |
| response-helper | Full | `apply_convention` |
| env-validation | Full | `apply_convention` |
| naming-conventions | Full | `refactor_rename_symbol` |
| import-order | Full | `generate_migration` |

**Target Coverage**: 80% of violations auto-fixable
