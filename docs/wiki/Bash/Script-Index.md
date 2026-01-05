# Bash Script Index

Complete reference for all shell scripts in the project.

## Script Categories

### Build & Deployment

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/cleanup.sh` | Full cleanup cycle (build, format, lint, test, docs) | `./bin/cleanup.sh [--fast\|--check]` |
| `bin/ci-local.sh` | Fast local CI checks | `./bin/ci-local.sh` |
| `bin/ci-local-full.sh` | Full CI with integration tests | `./bin/ci-local-full.sh` |
| `bin/build-dependencies.sh` | Build Lambda layer dependencies | `./bin/build-dependencies.sh` |
| `bin/pre-deploy-check.sh` | Pre-deployment validation | `./bin/pre-deploy-check.sh` |

### Validation

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/validate-docs.sh` | Verify documented scripts exist | `./bin/validate-docs.sh` |
| `bin/validate-doc-sync.sh` | Sync code with documentation | `./bin/validate-doc-sync.sh` |
| `bin/validate-graphrag.sh` | Check GraphRAG synchronization | `./bin/validate-graphrag.sh` |
| `bin/verify-state.sh` | Verify Terraform state health | `./bin/verify-state.sh` |

### Documentation

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/document-api.sh` | Generate OpenAPI docs from TypeSpec | `./bin/document-api.sh` |
| `bin/document-source.sh` | Generate TSDoc documentation | `./bin/document-source.sh` |

### Testing

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/test-list.sh` | Test ListFiles API endpoint | `./bin/test-list.sh` |
| `bin/test-hook.sh` | Test Feedly webhook endpoint | `./bin/test-hook.sh` |
| `bin/test-registerDevice.sh` | Test device registration | `./bin/test-registerDevice.sh` |
| `bin/test-integration.sh` | Run integration test suite | `./bin/test-integration.sh` |
| `bin/extract-fixtures.sh` | Extract test fixtures | `./bin/extract-fixtures.sh` |
| `bin/extract-production-fixtures.sh` | Extract production-like fixtures | `./bin/extract-production-fixtures.sh` |

### Dependency Management

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/update-yt-dlp.sh` | Update yt-dlp binary | `./bin/update-yt-dlp.sh` |
| `bin/update-youtube-cookies.sh` | Update YouTube auth cookies | `./bin/update-youtube-cookies.sh` |
| `bin/update-agents-prs.sh` | Update AGENTS.md with PR history | `./bin/update-agents-prs.sh` |

### Infrastructure

| Script | Purpose | Usage |
|--------|---------|-------|
| `bin/aws-audit.sh` | Comprehensive AWS infrastructure audit | `./bin/aws-audit.sh` |
| `bin/auto-update-graphrag.sh` | Auto-update knowledge graph | `./bin/auto-update-graphrag.sh` |

## Script Details

### cleanup.sh

Full cleanup cycle with multiple modes:

```bash
./bin/cleanup.sh          # Full cleanup with integration tests
./bin/cleanup.sh --fast   # Skip integration tests
./bin/cleanup.sh --check  # Dry-run, check only
```

**Steps Performed**:
1. TypeScript type checking
2. Build Lambda bundles
3. Format code (dprint)
4. Lint (ESLint)
5. Validate conventions
6. Run unit tests
7. Run integration tests (unless --fast)
8. Generate documentation

---

### ci-local.sh

Fast local CI for pre-commit validation:

```bash
./bin/ci-local.sh
```

**Approximate Time**: 2-3 minutes

**Checks**:
- Type checking
- Lint
- Format check
- Unit tests

---

### aws-audit.sh

Comprehensive AWS infrastructure audit:

```bash
./bin/aws-audit.sh
```

**Reports On**:
- Lambda function configurations
- API Gateway endpoints
- S3 buckets
- DynamoDB tables
- CloudWatch alarms
- IAM roles and policies
- Cost estimates

---

### pre-deploy-check.sh

Pre-deployment validation:

```bash
./bin/pre-deploy-check.sh
```

**Validates**:
- All tests pass
- No lint errors
- Bundle sizes within limits
- Environment variables configured
- Terraform plan succeeds

---

### validate-doc-sync.sh

Validates documentation matches code:

```bash
./bin/validate-doc-sync.sh
```

**Checks**:
- Lambda handlers documented
- Entity schemas documented
- API endpoints documented
- Script purposes documented

---

## Script Conventions

All scripts follow patterns defined in [Script-Patterns.md](./Script-Patterns.md):

### Shebang
```bash
#!/usr/bin/env bash
```

### Error Handling
```bash
set -euo pipefail
```

### Help Flag
```bash
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [options]"
  exit 0
fi
```

### Color Output
```bash
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

echo -e "${GREEN}Success${NC}"
```

### Directory Resolution
```bash
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
```

## Adding New Scripts

1. Create script in `bin/` directory
2. Add shebang and error handling
3. Add help flag support
4. Document in this index
5. Run `./bin/validate-docs.sh` to verify

## Related Documentation

- [Script-Patterns.md](./Script-Patterns.md) - Coding patterns
- [Bash-Error-Handling.md](./Bash-Error-Handling.md) - Error handling
- [Variable-Naming.md](./Variable-Naming.md) - Naming conventions
- [User-Output-Formatting.md](./User-Output-Formatting.md) - Output formatting
