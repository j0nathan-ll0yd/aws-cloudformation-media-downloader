# CI Coverage Matrix

This document provides a comprehensive comparison of checks run across different CI environments: local CI scripts and GitHub Actions workflows.

## Quick Reference

| Script/Workflow | Purpose | Approx. Time |
|-----------------|---------|--------------|
| `pnpm run ci:local` | Fast local CI (no integration tests) | ~2-3 min |
| `pnpm run ci:local:full` | Full local CI with integration tests | ~5-10 min |
| `pnpm run cleanup` | Comprehensive cleanup with auto-fixes | Varies |
| GitHub `unit-tests.yml` | Remote unit test pipeline | ~3-5 min |
| GitHub `integration-tests.yml` | Remote integration tests | ~5-8 min |

## Detailed Coverage Matrix

### Build & Dependencies

| Check | ci-local.sh | cleanup.sh | GH unit-tests | GH integration |
|-------|:-----------:|:----------:|:-------------:|:--------------:|
| Node.js version check | Yes | No | .nvmrc | .nvmrc |
| hcl2json check | Yes | No | Homebrew action | No |
| jq check | Yes | No | No | No |
| pnpm install | Yes | Yes | Yes | Yes |
| generate-graph | Yes (in build) | Yes | Yes (in build) | No |
| TypeSpec compile | Yes | Yes | Yes | No |
| build-dependencies | Yes | Yes | Yes | No |
| esbuild build | Yes | Yes | Yes | No |

### Type Checking & Linting

| Check | ci-local.sh | cleanup.sh | GH unit-tests | GH integration |
|-------|:-----------:|:----------:|:-------------:|:--------------:|
| check-types | Yes (parallel) | Yes | Yes | No |
| check-test-types | Yes (parallel) | Yes | Yes | No |
| ESLint | Yes | Yes (with fix) | Yes | No |
| ESLint rules tests | Yes | Yes | Yes | No |
| dprint check | Yes | Check only | Yes | No |
| Terraform fmt | Yes | No | Yes | No |
| actionlint | No | Optional | No | No |

### Validation

| Check | ci-local.sh | cleanup.sh | GH unit-tests | GH integration |
|-------|:-----------:|:----------:|:-------------:|:--------------:|
| validate:conventions | Yes (parallel) | Yes | Yes | No |
| validate:config | Yes (parallel) | Yes | Yes | No |
| validate:api-paths | Yes (parallel) | Yes | Yes | No |
| validate:docs | Yes | Yes | Yes | No |
| validate:doc-sync | Yes | Yes | Yes | No |
| validate:graphrag | Yes | Yes | Yes | No |
| deps:check | Yes | Yes | No* | No |
| check:bundle-size | No | No | Yes | No |
| pnpm audit | Yes | No | Yes | No |

*Note: deps:check runs in separate `dependency-check.yml` workflow.

### Testing

| Check | ci-local.sh | cleanup.sh | GH unit-tests | GH integration |
|-------|:-----------:|:----------:|:-------------:|:--------------:|
| Unit tests | Yes | Yes | Yes | No |
| Test output validation | Yes | Yes | Yes | No |
| Integration tests | No | Full mode | No | Yes |
| Coverage upload | No | No | Yes | Yes |

### Documentation & Context (cleanup.sh only)

| Check | ci-local.sh | cleanup.sh | cleanup --check |
|-------|:-----------:|:----------:|:---------------:|
| document-source | No | Yes | No |
| document-terraform | No | Yes | No |
| document-api | No | Yes | No |
| graphrag:extract | No | Yes | No |
| pack:context | No | Yes | No |

## Parallel Execution

### ci-local.sh Parallelization

The local CI script uses parallel execution for independent steps:

1. **Type Checking (Step 6)**: `check-types` and `check-test-types` run in parallel
2. **Validation (Steps 12-14)**: `validate:conventions`, `validate:config`, and `validate:api-paths` run in parallel

### GitHub Actions Parallelization

The unit-tests workflow runs 3 parallel jobs before the final test job:

```
validate ────────────────────┐
lint-and-types ──────────────┼──> test
build-and-validate ──────────┘
```

## Usage Recommendations

### Before Committing (Fast Check)
```bash
pnpm run ci:local
```
Runs all essential checks in ~2-3 minutes with parallel execution.

### Before Pushing (Full Check)
```bash
pnpm run ci:local:full
```
Includes integration tests against LocalStack (~5-10 minutes).

### Cleanup with Auto-Fixes
```bash
pnpm run cleanup        # Full cleanup with integration tests
pnpm run cleanup:fast   # Skip integration tests
pnpm run cleanup:check  # Dry-run, no fixes
```

## What Cannot Be Run Locally

Some GitHub Actions features cannot be replicated locally:

- Codecov upload and coverage comments
- Artifact storage between jobs
- PR comments and annotations
- Status checks on commits
- Secrets injection (production credentials)

## Related Documentation

- [Bash Script Patterns](../Bash/Script-Patterns.md)
- [Testing Coverage Philosophy](../Testing/Coverage-Philosophy.md)
- [Git Workflow](../Conventions/Git-Workflow.md)
