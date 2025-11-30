# Local CI Testing

This guide explains how to run CI checks locally before pushing to GitHub, ensuring faster feedback and reduced CI usage.

## Background

Previously, this project used `nektos/act` for local GitHub Actions testing. It was removed due to Apple Silicon (ARM64) incompatibility - the x86-64 Linux containers required for GitHub Actions cause Rosetta translation failures on M1/M2/M3 Macs.

Instead, we use **workflow decomposition**: CI logic is extracted into reusable shell scripts that run both locally and in GitHub Actions, ensuring consistency.

## Quick Start

```bash
# First time setup (installs git hooks)
pnpm run prepare

# Fast CI (no integration tests) - recommended for most iterations
pnpm run ci:local

# Full CI (includes integration tests with LocalStack)
pnpm run ci:local:full
```

## Pre-Push Hook

This project uses Husky to enforce CI checks before pushing. When you run `git push`, the pre-push hook automatically runs `pnpm run ci:local:full` (~5-10 minutes).

**First time setup** (after cloning):
```bash
pnpm install
pnpm run prepare  # Installs git hooks
```

**To bypass in emergencies**:
```bash
git push --no-verify
```

Note: Lifecycle scripts are disabled in `.npmrc` for security, so `pnpm run prepare` must be run manually once after cloning.

## Available Commands

| Command | Duration | What it runs |
|---------|----------|--------------|
| `pnpm run ci:local` | ~2-3 min | All checks except integration tests |
| `pnpm run ci:local:full` | ~5-10 min | Everything including integration tests |
| `pnpm run test:integration` | ~30 sec | Integration tests only (LocalStack must be running) |
| `pnpm run validate:docs` | ~1 sec | Documentation script validation only |
| `pnpm run validate:graphrag` | ~5 sec | GraphRAG freshness check only |
| `pnpm run lint:workflows` | ~1 sec | GitHub Actions YAML validation (requires actionlint) |

### Why Both `ci:local:full` and `test:integration`?

These serve different purposes:

| Command | LocalStack Lifecycle | Use Case |
|---------|---------------------|----------|
| `ci:local:full` | Manages start/stop automatically | Pre-push validation, comprehensive CI |
| `test:integration` | Assumes already running | Fast iteration when developing tests |

**When developing integration tests**, use `test:integration` for rapid feedback:

```bash
# Start LocalStack once at the beginning of your session
pnpm run localstack:start

# Iterate rapidly (~30s per run instead of 5-10 min)
pnpm run test:integration   # run tests
# make changes...
pnpm run test:integration   # run again
# make changes...
pnpm run test:integration   # run again

# Stop when done
pnpm run localstack:stop
```

**For pre-push validation**, use `ci:local:full` (or let the pre-push hook run it automatically).

## What ci:local Checks

The fast CI script (`pnpm run ci:local`) runs these checks in order:

1. **Prerequisites** - Node.js 22+, hcl2json, jq
2. **Dependencies** - `pnpm install --frozen-lockfile`
3. **Build dependencies** - Terraform type generation
4. **Webpack build** - Lambda function compilation
5. **Type checking** - TypeScript compiler
6. **Linting** - ESLint
7. **Documentation validation** - Ensures documented scripts exist
8. **Dependency rules** - Architectural boundary checks
9. **GraphRAG validation** - Knowledge graph freshness
10. **Unit tests** - Jest with mocked AWS services

## What ci:local Does NOT Check

These checks can only run in GitHub Actions:

- **Codecov upload** - Requires GitHub secrets
- **Artifact storage** - GitHub infrastructure
- **PR comments** - Requires GitHub API context
- **Wiki sync** - Only runs on push to master

## Coverage Estimate

Running `ci:local` catches approximately **95%** of issues that would fail in GitHub Actions CI. The remaining 5% are GitHub-specific features that cannot be replicated locally.

## Prerequisites

Before running local CI, ensure you have:

```bash
# Required tools
brew install hcl2json jq

# For integration tests
# Docker Desktop must be installed and running

# Optional: workflow validation
brew install actionlint
```

## Workflow Validation with actionlint

For validating GitHub Actions workflow YAML files without execution:

```bash
# Install actionlint (ARM64 native, no Docker required)
brew install actionlint

# Validate all workflows
pnpm run lint:workflows

# Or run directly
actionlint
```

This catches:
- YAML syntax errors
- Invalid action references
- Expression syntax errors (`${{ }}`)
- Shell script issues (via shellcheck integration)

## Recommended Workflow

1. **During development**: Run `pnpm run precheck` frequently (type check + lint)
2. **Before committing**: Run `pnpm run ci:local` (fast, ~2-3 min)
3. **Before pushing**: The pre-push hook runs `ci:local:full` automatically
4. **After pushing**: Monitor GitHub Actions for the remaining 5% of checks

## Troubleshooting

### "hcl2json not found"

```bash
brew install hcl2json
```

### "jq not found"

```bash
brew install jq
```

### Integration tests fail to connect to LocalStack

```bash
# Ensure Docker is running
docker ps

# Check LocalStack health
pnpm run localstack:health

# Restart LocalStack
pnpm run localstack:stop && pnpm run localstack:start
```

### GraphRAG validation fails

```bash
# Regenerate and commit the knowledge graph
pnpm run graphrag:extract
git add graphrag/knowledge-graph.json
git commit -m "chore: update GraphRAG knowledge graph"
```

## Architecture

The local CI approach uses **workflow decomposition**:

```
GitHub Actions                    Local Development
─────────────────                 ─────────────────
.github/workflows/                bin/
├── unit-tests.yml       ───────► ├── ci-local.sh
│   └── calls validate-docs.sh    ├── validate-docs.sh
├── dependency-check.yml ───────► └── validate-graphrag.sh
│   └── calls validate-graphrag.sh
└── integration-tests.yml ──────► └── test-integration.sh
```

Both CI and local development use the **same scripts**, ensuring:
- Identical behavior between environments
- Easy maintenance (one source of truth)
- No architecture mismatch issues (scripts run natively)

## See Also

- [Coverage Philosophy](./Coverage-Philosophy.md)
- [Jest ESM Mocking Strategy](./Jest-ESM-Mocking-Strategy.md)
- [LocalStack Testing](../Integration/LocalStack-Testing.md)
