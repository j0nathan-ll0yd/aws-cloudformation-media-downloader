# Script Registry

Central documentation for all npm scripts in this project. This page is the authoritative reference for script purposes, dependencies, and usage.

## CI Validation

Scripts documented in `AGENTS.md` and `README.md` are automatically validated against `package.json` in CI. If a documented script doesn't exist, the build fails.

**Enforcement**: `.github/workflows/unit-tests.yml` - "Validate documented scripts exist" step

---

## Build & Development Scripts

### `pnpm run build`
**Purpose**: Compile TypeScript Lambda functions with webpack
**Dependencies**: ts-node, webpack
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Automatically runs `generate-graph` first to create dependency analysis

### `pnpm run build-dependencies`
**Purpose**: Build external dependencies (yt-dlp binary layer)
**Dependencies**: Docker, shell access
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Required before first build; creates Lambda layer with yt-dlp

### `pnpm run check-types`
**Purpose**: TypeScript type checking without emit
**Dependencies**: TypeScript
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Fast validation of type correctness

### `pnpm run generate-graph`
**Purpose**: Generate `build/graph.json` dependency analysis
**Dependencies**: ts-morph
**CI Coverage**: Yes (via build/test)
**Notes**: Critical for Jest mocking - shows transitive dependencies

---

## Testing Scripts

### `pnpm run test`
**Purpose**: Run unit tests with Jest
**Dependencies**: Jest, ts-node
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Runs `generate-graph` first; use `--coverage` for reports

### `pnpm run test:integration`
**Purpose**: Run integration tests against LocalStack
**Dependencies**: LocalStack (Docker), Jest
**CI Coverage**: No (requires Docker)
**Notes**: Requires `localstack:start` first; validates real DynamoDB operations

### `pnpm run test:integration:with-lifecycle`
**Purpose**: Full integration test suite with LocalStack lifecycle
**Dependencies**: Docker, shell access
**CI Coverage**: No
**Notes**: Starts LocalStack, runs tests, stops LocalStack

---

## Local CI Scripts

### `pnpm run ci:local`
**Purpose**: Run all CI checks locally (fast mode, no integration tests)
**Dependencies**: Node.js 22+, hcl2json, jq
**CI Coverage**: Mirrors unit-tests.yml + dependency-check.yml
**Notes**: ~2-3 minutes; catches ~95% of CI failures. Use before committing.

### `pnpm run ci:local:full`
**Purpose**: Run complete CI checks including integration tests
**Dependencies**: All ci:local deps + Docker (for LocalStack)
**CI Coverage**: Mirrors all CI workflows
**Notes**: ~5-10 minutes; includes LocalStack lifecycle management.

### `pnpm run validate:docs`
**Purpose**: Validate documented scripts exist in package.json
**Dependencies**: jq
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Checks AGENTS.md and README.md for pnpm run commands.

### `pnpm run validate:graphrag`
**Purpose**: Validate GraphRAG knowledge graph is up to date
**Dependencies**: ts-morph
**CI Coverage**: Yes (dependency-check.yml)
**Notes**: Regenerates graph and checks for uncommitted changes.

### `pnpm run lint:workflows`
**Purpose**: Validate GitHub Actions workflow YAML syntax
**Dependencies**: actionlint CLI
**CI Coverage**: No (manual validation)
**Notes**: Install with `brew install actionlint`. Native ARM64 binary.

---

## Remote Testing Scripts

### `pnpm run test-remote-list`
**Purpose**: Test ListFiles Lambda against production API
**Dependencies**: AWS credentials, jq
**CI Coverage**: No (requires production)
**Notes**: Validates API Gateway → Lambda → DynamoDB flow

### `pnpm run test-remote-hook`
**Purpose**: Test Feedly webhook against production API
**Dependencies**: AWS credentials, jq
**CI Coverage**: No (requires production)
**Notes**: Tests webhook authentication and processing

### `pnpm run test-remote-registerDevice`
**Purpose**: Test RegisterDevice Lambda against production API
**Dependencies**: AWS credentials, jq
**CI Coverage**: No (requires production)
**Notes**: Uses idempotent synthetic device; creates SNS Platform Endpoint

---

## LocalStack Scripts

### `pnpm run localstack:start`
**Purpose**: Start LocalStack Docker container
**Dependencies**: Docker, docker-compose
**CI Coverage**: No
**Notes**: Required before `test:integration`

### `pnpm run localstack:stop`
**Purpose**: Stop LocalStack Docker container
**Dependencies**: Docker, docker-compose
**CI Coverage**: No
**Notes**: Clean up after integration testing

### `pnpm run localstack:logs`
**Purpose**: Tail LocalStack container logs
**Dependencies**: Docker, docker-compose
**CI Coverage**: No
**Notes**: Useful for debugging integration test failures

### `pnpm run localstack:health`
**Purpose**: Check LocalStack health endpoint
**Dependencies**: curl, jq
**CI Coverage**: No
**Notes**: Quick verification LocalStack is running

---

## Code Quality Scripts

### `pnpm run lint`
**Purpose**: Run ESLint on codebase
**Dependencies**: ESLint
**CI Coverage**: Yes (unit-tests.yml)
**Notes**: Uses `eslint.config.mjs` configuration

### `pnpm run lint-fix`
**Purpose**: Auto-fix ESLint violations
**Dependencies**: ESLint
**CI Coverage**: No
**Notes**: Run locally before committing

### `pnpm run format`
**Purpose**: Format code with Prettier
**Dependencies**: Prettier
**CI Coverage**: No
**Notes**: 250 character line limit; run before commits

---

## Documentation Scripts

### `pnpm run document-source`
**Purpose**: Generate TypeDoc documentation
**Dependencies**: TypeDoc, shell access
**CI Coverage**: No
**Notes**: Creates HTML documentation from TSDoc comments

### `pnpm run document-terraform`
**Purpose**: Generate Terraform/OpenTofu documentation
**Dependencies**: terraform-docs CLI
**CI Coverage**: No
**Notes**: Updates `docs/terraform.md`

### `pnpm run document-api`
**Purpose**: Generate API documentation from TypeSpec
**Dependencies**: TypeSpec CLI, shell access
**CI Coverage**: No
**Notes**: Creates OpenAPI spec and ReDoc HTML

---

## Fixture Scripts

### `pnpm run extract-fixtures`
**Purpose**: Extract test fixtures from CloudWatch logs
**Dependencies**: AWS CLI, jq
**CI Coverage**: No
**Notes**: Pulls production request/response pairs for tests

### `pnpm run extract-fixtures:production`
**Purpose**: Extract production fixtures with timestamps
**Dependencies**: AWS CLI, jq
**CI Coverage**: No
**Notes**: Similar to `extract-fixtures` but for production data

### `pnpm run process-fixtures`
**Purpose**: Process extracted fixtures for test use
**Dependencies**: Node.js
**CI Coverage**: No
**Notes**: Transforms raw CloudWatch data into test fixtures

---

## Maintenance Scripts

### `pnpm run update-cookies`
**Purpose**: Update YouTube authentication cookies
**Dependencies**: Browser, shell access
**CI Coverage**: No
**Notes**: Required when YouTube cookies expire

### `pnpm run update-yt-dlp`
**Purpose**: Update yt-dlp binary in Lambda layer
**Dependencies**: Docker, shell access
**CI Coverage**: No
**Notes**: Keep yt-dlp current for YouTube compatibility

### `pnpm run install-prod`
**Purpose**: Install production dependencies only
**Dependencies**: pnpm
**CI Coverage**: No
**Notes**: Smaller `node_modules` for deployment

---

## Infrastructure Scripts

### `pnpm run plan`
**Purpose**: Run OpenTofu plan
**Dependencies**: OpenTofu, AWS credentials, `.env` file
**CI Coverage**: No
**Notes**: Preview infrastructure changes

### `pnpm run deploy`
**Purpose**: Deploy infrastructure with OpenTofu
**Dependencies**: OpenTofu, AWS credentials, `.env` file
**CI Coverage**: No
**Notes**: Auto-approve enabled; use with caution

---

## External Tool Requirements

| Tool | Scripts Using It | Installation |
|------|------------------|--------------|
| Docker | build-dependencies, localstack:*, test:integration, ci:local:full | `brew install docker` |
| terraform-docs | document-terraform | `brew install terraform-docs` |
| hcl2json | ci:local, build-dependencies | `brew install hcl2json` |
| jq | test-remote-*, localstack:health, validate:docs | `brew install jq` |
| actionlint | lint:workflows | `brew install actionlint` |
| OpenTofu | plan, deploy | `brew install opentofu` |

---

## Adding New Scripts

When adding a new npm script:

1. Add to `package.json` scripts section
2. Document in this registry with:
   - Purpose
   - Dependencies
   - CI Coverage (add to workflow if appropriate)
   - Notes
3. If documented in `AGENTS.md` or `README.md`, CI will validate it exists

**Convention**: Script documentation must stay synchronized with `package.json`. CI enforces this for scripts referenced in main documentation files.

---

## Related Documentation

- [Bash Script Patterns](../Bash/Script-Patterns.md) - Shell script conventions
- [GitHub Wiki Sync](../Meta/GitHub-Wiki-Sync.md) - CI/CD documentation
- [LocalStack Testing](../Integration/LocalStack-Testing.md) - Integration test setup
