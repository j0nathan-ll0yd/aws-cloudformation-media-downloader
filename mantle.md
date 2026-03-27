# TypeScript Tech Stack & Cross-Repository Conventions

This document is the **authoritative source** for conventions shared across all TypeScript repositories in this ecosystem. When a per-project `CLAUDE.md` contradicts this file, this file wins unless the project doc explicitly notes a justified exception.

**Hierarchy:**
- **This file** (`typescript-tech-stack.md`): Cross-repo standards — the "what" and "why"
- **Per-project `CLAUDE.md`**: Project-specific implementation details — the "how" in that repo

**Scope:** Conventions that apply to ALL repositories. Project-specific patterns (e.g., iOS HealthKit sync schemas, media-downloader's handler class hierarchy) belong in per-project docs.

**Audience:** New repositories, AI assistants, onboarding developers.

**Repositories governed:**
- `mantle/` — Shared framework (monorepo, 13 `@mantleframework/*` packages)
- `mantle-Lifegames-Portal/` — Production instance built on mantle
- `mantle-OfflineMediaDownloader/` — Original project mantle was extracted from

---

## Tech Stack

- **Language**: TypeScript 6.0+ (`typescript@beta`)
- **Runtime**: Node.js 24+
- **Unit Testing**: Vitest 4.0+ (`vitest@beta`)
- **Integration Testing**: LocalStack (EventBridge, S3, DynamoDB, SQS); Docker PostgreSQL for Aurora DSQL
- **Linting**: ESLint 10+ (flat config)
- **Formatting**: dprint 0.52+
- **Package Manager**: pnpm 10+
- **Bundler**: unbuild (instances + framework), esbuild (media-downloader legacy)
- **Database**: Aurora DSQL via Drizzle ORM
- **Infrastructure**: OpenTofu >= 1.8.0, AWS provider latest major
- **Observability**: AWS Lambda Powertools (logger/metrics), OpenTelemetry (tracing)
- **Version Control**: Git
- **CI/CD**: GitHub Actions
- **API Documentation**: OpenAPI via `@asteasolutions/zod-to-openapi`
- **Source Code Documentation**: TypeDoc
- **Wiki / Guides**: VitePress

---

## Language & Compiler

### TypeScript version — REQUIRED

TypeScript 6.0+ (`typescript@beta`). Pinned via pnpm catalog in framework repos.

### Strict mode flags — REQUIRED

All `tsconfig.json` files MUST enable:

| Flag | Purpose |
|------|---------|
| `strict: true` | Enables all strict type-checking options |
| `verbatimModuleSyntax: true` | Enforces `import type` for type-only imports |

### `noUncheckedIndexedAccess` — REQUIRED
### `isolatedDeclarations` — REQUIRED

### Stage 3 decorators only — REQUIRED

Never set `experimentalDecorators: true`. All decorator usage must use Stage 3 syntax (`ClassMethodDecoratorContext`, `ClassDecoratorContext`).

### Target — REQUIRED

- TypeScript `target`: `ES2025`
- Node.js runtime: `>= 24.0.0` (pinned in `.nvmrc`)

---

## Module System

### ESM only — REQUIRED

All repositories use `"type": "module"` in `package.json`. Use `import`/`export` exclusively. Never use `require()`.

**Exception:** `eslint-local-rules/` directory uses CommonJS (`.cjs` files) — this is an ESLint local rules loading requirement.

### Path aliases — RECOMMENDED

**DIVERGENCE:** Media-downloader uses `#`-prefixed Node.js subpath imports (`#entities/*`, `#lib/*`, `#util/*`, etc.) via `tsconfig.json:15-23` paths + `package.json:156-164` imports field. Mantle and Lifegames Portal use relative imports or `@mantleframework/*` package imports.

**Position:** Path aliases are acceptable for standalone instance repos but NOT recommended for framework packages (breaks when consumed as dependencies). Instance repos MAY use them.

This means using `#`-prefixed Node.js subpath imports (`#entities/*`, `#lib/*`, `#util/*`, etc.) via `tsconfig.json` paths + `package.json` imports field.

---

## Formatting & Linting

### dprint (never Prettier) — REQUIRED

All repos use identical dprint configuration:

| Setting | Value |
|---------|-------|
| `lineWidth` | `157` |
| `indentWidth` | `2` |
| `useTabs` | `false` |
| `newLineKind` | `lf` |
| `quoteStyle` | `preferSingle` |
| `semiColons` | `asi` (no semicolons) |
| `trailingCommas` | `never` (everywhere) |
| `bracePosition` | `sameLine` |
| `nextControlFlowPosition` | `sameLine` |
| `arrowFunction.useParentheses` | `force` |
| `importDeclaration.sortNamedImports` | `caseInsensitive` |
| Plugins | `typescript-0.93.4.wasm`, `json-0.19.4.wasm` |

### ESLint flat config — REQUIRED

All repos use `eslint.config.mjs` (flat config) with these plugins:
- `@typescript-eslint` — TypeScript-aware linting
- `eslint-plugin-drizzle` — database safety rules
- `eslint-plugin-tsdoc` — TSDoc syntax validation
- `eslint-plugin-jsdoc` — JSDoc presence enforcement
- `local-rules` — custom rules loaded from `./eslint-local-rules/index.cjs` via `createRequire`

### Custom local ESLint rules — REQUIRED

All repos have an `eslint-local-rules/` directory with CommonJS rule files loaded via `createRequire`. Core shared rules:

| Rule | Severity | Purpose |
|------|----------|---------|
| `cascade-delete-order` | warn | Detect `Promise.all` with deletes (ordering risk) |
| `migrations-safety` | error | Schema changes only in migration files |
| `response-helpers` | warn | Enforce `buildValidatedResponse()` |
| `env-validation` | error | Enforce `getRequiredEnv()` |
| `enforce-powertools` | error | Enforce observability wrapper |
| `strict-env-vars` | error | Forbid direct `process.env` in handlers |
| `spacing-conventions` | warn | Function spacing patterns |
| `import-order` | warn | Consistent import ordering |

### Drizzle ORM safety rules — REQUIRED

```
drizzle/enforce-delete-with-where: error  (on db and tx objects)
drizzle/enforce-update-with-where: error  (on db and tx objects)
```

### JSDoc conventions — REQUIRED

- `jsdoc/require-jsdoc: warn` for exported function declarations
- `jsdoc/no-types: error` — types belong in TypeScript, not JSDoc `{type}` annotations
- Never inline code examples with decorators or `@mantleframework/*` package refs in `@example` blocks (TSDoc parser chokes on `@` symbols). Use `@see` links to wiki pages instead.
- Escape `@` in prose: `\@RequiresTable`, `\@mantleframework/core`

---

## Testing

### Framework — REQUIRED

Vitest 4.0+ (`vitest@beta`).

### Coverage philosophy — RECOMMENDED

Coverage should be obtained **either** by a unit test or integration test, not both. Unit tests for individual functions in isolation. Integration tests for component interaction.

### Coverage provider — REQUIRED

Standardize on `@vitest/coverage-v8`.

### Test file location — REQUIRED

**Centralized `test/` directory** that mirrors the `src/` tree. This is the standard for all Mantle-based projects.

```
project/
├── src/
│   ├── lambdas/SyncHealth/index.ts
│   ├── services/healthExportService.ts
│   └── entities/queries/healthQueries.ts
└── test/
    ├── lambdas/SyncHealth.test.ts
    ├── services/healthExportService.test.ts
    └── entities/healthQueries.test.ts
```

**Why centralized over co-located:**
- Single `exclude: ["test"]` keeps test code out of Lambda bundles (cold start impact)
- Single Vitest glob: `include: ["test/**/*.test.ts"]`
- Cross-cutting tests (spanning multiple modules) have a natural home
- Flat, scannable test surface — entire test suite visible at a glance

**Integration tests** live under `test/integration/` with `*.integration.test.ts` suffix and separate Vitest configs.

See [ADR 001: Test Directory Structure](mantle-Lifegames-Portal/docs/adr/001-test-directory-structure.md) for the full rationale, including when co-location would be preferred (large multi-file handlers, feature-slice teams).

### Mutation testing (Stryker) — RECOMMENDED

Some projects use `@stryker-mutator/core` with `@stryker-mutator/vitest-runner` for mutation testing.

**Recommended for mature codebases** with stable test suites. Not required for early-stage projects.

### Real database testing — INFORMATIONAL

LocalStack doesn't support Aurora DSQL. Use Docker PostgreSQL instances for database integration tests. Vitest integration configs use `USE_LOCALSTACK=true` for EventBridge/S3/DynamoDB/SQS services.

---

## Error Handling

### Error hierarchy — REQUIRED

All repos use `CustomLambdaError` as the base error class with `statusCode`, `code`, `errors`, `cause`, and `context` properties. Method `.withContext(ctx)` for chaining.

Standard subclasses:
| Class | Status Code |
|-------|-------------|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `DatabaseError` | 500 |
| `ServiceUnavailableError` | 503 |
| `UnexpectedError` | 500 |

### Response helpers — REQUIRED

- `buildValidatedResponse(context, statusCode, data, zodSchema)` — validates response body against Zod schema before returning
- `buildErrorResponse(error, context)` — centralized error-to-HTTP-response conversion with SQL leak prevention

### Result type — RECOMMENDED

`ok()`/`err()` discriminated union (`Result<T, E>`) for service-layer error handling. Avoids exceptions for expected failure paths.

---

## Resilience

Every external call must have a timeout, and transient failures should be retried with backoff. Use `@mantleframework/resilience` and `@mantleframework/aws`.

### `fetchWithTimeout` — REQUIRED

All external HTTP requests MUST use `fetchWithTimeout` from `@mantleframework/resilience` (never raw `fetch`). Every call must have an explicit timeout.

### `withRetry` — RECOMMENDED

Use `withRetry` from `@mantleframework/aws` with exponential backoff and jitter for transient AWS SDK failures (EventBridge publishing, S3 operations).

### Circuit breaker — RECOMMENDED

`@mantleframework/resilience` provides a circuit breaker (CLOSED/OPEN/HALF_OPEN) for external service calls that may fail transiently. Recommended for any integration that calls a third-party API.

---

## Observability

### Logger and metrics — REQUIRED

AWS Lambda Powertools for logger and metrics. Singletons are lazy-initialized (env vars read on first access, not import time).

### Tracing — REQUIRED

OpenTelemetry for distributed tracing. All Lambda functions have X-Ray tracing enabled (`tracing_config { mode = "Active" }`).

### Handler wrapper — REQUIRED

All handlers MUST use `withObservability` (Mantle) or `withPowertools` (media-downloader) to ensure:
- Cold start metric on first invocation
- Lambda context injection into logger
- Correlation ID extraction
- Success/failure metrics
- Incoming/outgoing event logging (sanitized)
- Metrics flush in `finally` block

### PII sanitization — REQUIRED

All logged data passes through `sanitizeData()` which redacts fields matching `DEFAULT_SENSITIVE_PATTERNS`: authorization, token, password, apiKey, secret, privateKey, email, phoneNumber, ssn, creditCard, firstName, lastName.

---

## Database

### Aurora DSQL — REQUIRED

Aurora DSQL is the primary database across all projects.

### Drizzle ORM — REQUIRED

Database access via `getDrizzleClient()` async factory with IAM token caching (15-minute validity, 3-minute refresh buffer).

### Entity query pattern — REQUIRED

All database queries use this pattern:
1. Static class with static methods
2. Each method decorated with `@RequiresTable([{ table, operations }])` (Stage 3 method decorator)
3. Method body wrapped in `withQueryMetrics('ClassName.methodName', async () => { ... })`
4. Exported as bound functions at bottom of file: `export const getUser = UserQueries.getUser.bind(UserQueries)`

### DSQL constraints — REQUIRED

- Single DDL statement per transaction
- Do NOT use `REVOKE ALL ON ALL TABLES` (DSQL handles differently than standard PostgreSQL)
- Do NOT use `GRANT USAGE ON SCHEMA public` (DSQL doesn't support schema-level GRANT)
- Working pattern: `CREATE ROLE ... WITH LOGIN` -> `GRANT ops ON table TO role` -> `AWS IAM GRANT role TO 'arn:...'`
- Permissions changes may take up to 1 hour on existing connections; new connections see them immediately

---

## Environment Variables

### Access pattern — REQUIRED

- `getRequiredEnv(name)` — throws `MissingEnvVarError` if not set or empty
- `getOptionalEnv(name, defaultValue)` — returns default if not set

Raw `process.env` access is banned by the `strict-env-vars` ESLint rule (error severity).

**Anti-pattern:** Module-level `const X = getRequiredEnv('X')` is forbidden — must be inside function/handler body to avoid cold-start failures when env vars aren't yet available.

---

## Lambda Handlers

### Function-based factories — REQUIRED

All new handler code MUST use function-based `define*Handler` factories (not class-based):

| Factory | Package | Trigger |
|---------|---------|---------|
| `defineApiHandler` | `@mantleframework/validation` | API Gateway REST |
| `defineEventBridgeHandler` | `@mantleframework/core` | EventBridge rules |
| `defineScheduledHandler` | `@mantleframework/core` | CloudWatch Schedules |
| `defineSqsHandler` | `@mantleframework/core` | SQS queues |
| `defineS3Handler` | `@mantleframework/core` | S3 events |
| `defineWebSocketHandler` | `@mantleframework/core` | WebSocket API Gateway |

### Middleware — REQUIRED

**DIVERGENCE:** Media-downloader uses `@middy/core` for Lambda middleware composition. Mantle handler factories embed middleware concerns (observability, auth, validation) directly. **middy MUST NOT be used in new projects.** Existing middy usage in media-downloader is legacy.

### Lambda directory structure — REQUIRED

```
src/lambdas/
  api/            # API Gateway routed (file-system routing: path/method.ts)
  standalone/     # Direct invocation, no triggers
  eventbridge/    # EventBridge-triggered handlers
  scheduled/      # Scheduled (EventBridge rules / cron)
  s3/             # S3 event-triggered handlers
  sqs/            # SQS queue-triggered handlers
  websocket/      # API Gateway WebSocket route handlers
```

### Architecture — REQUIRED

All standard Lambda functions use `arm64` (Graviton2) architecture.

**Exception:** Lambda@Edge functions MUST use `x86_64`. AWS does not support arm64 at edge locations — this is a hard platform constraint, not a configuration choice. See [AWS Lambda@Edge restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html).

### Runtime — REQUIRED

Node.js 24 (`nodejs24.x`) for all Lambda functions.

---

## API Conventions

### Response validation — REQUIRED

All API responses MUST use `buildValidatedResponse(context, statusCode, data, zodSchema)` to validate response bodies against Zod schemas before returning.

### Authentication — REQUIRED

Two authentication patterns are supported. Choose based on whether the API serves end-user sessions or machine-to-machine calls.

#### Static bearer token (machine-to-machine)

For APIs called by iOS apps, scripts, or other services using a shared secret:

- Use `auth: 'bearer'` option on `defineApiHandler`
- Validates the `Authorization: Bearer <token>` header against the `API_BEARER_TOKEN` environment variable
- Uses `timingSafeEqual` from `node:crypto` for constant-time comparison (prevents timing attacks)
- No user identity — just allow/deny at the deployment level
- Env var: `API_BEARER_TOKEN`

#### BetterAuth (user sessions)

For APIs that need per-user identity, session management, and social login (Apple Sign In):

- **API Gateway custom authorizer** validates session tokens before the handler runs
- Authorizer flow: validate API key → extract `Bearer <session-token>` → DB lookup via `sessions.token` index → check expiry → return IAM Allow policy with `principalId = userId`
- **Handler auth levels** (via `UserStatus` enum):

| Status | Meaning | `AuthenticatedHandler` | `OptionalAuthHandler` |
|--------|---------|----------------------|---------------------|
| `Authenticated` | Valid token, userId available | Allowed | Allowed |
| `Unauthenticated` | Invalid/expired token sent | Rejected (401) | Rejected (401) |
| `Anonymous` | No token sent at all | Rejected (401) | Allowed |

- **Session lifecycle**: 30-day expiry, `updatedAt` touched on every valid auth, no cookie cache (serverless)
- **Apple Sign In**: ID token validated via Apple's public JWKS; `appBundleIdentifier` configured for iOS native flow
- **Database tables**: `users`, `sessions`, `accounts`, `verification` — backed by `@better-auth/drizzle-adapter`
- Env vars: `BETTER_AUTH_SECRET`, `APPLICATION_URL`, `SIGN_IN_WITH_APPLE_CONFIG`

#### Webhook signature validation

For inbound webhooks (GitHub, etc.) that use HMAC signatures instead of bearer tokens:

- Use `auth: 'none'` on `defineApiHandler`
- Validate signature manually inside the handler using `createHmac` + `timingSafeEqual`
- Check `X-Hub-Signature-256` header (case-insensitive fallback)

### Schema validation — REQUIRED

Zod for all request/response validation. Import `z` from `@mantleframework/validation` (not directly from `zod`).

For JSON Schema generation, use Zod 4 native `z.toJSONSchema()`. Do NOT use `zod-to-json-schema@3.x` (incompatible with Zod 4 — produces empty `{}` definitions).

### OpenAPI metadata — RECOMMENDED

Use `openapi: { summary, tags }` on handler config for OpenAPI spec generation. Use `@asteasolutions/zod-to-openapi` for full OpenAPI document generation.

### Required Actions

If you make changes to a request or response schema, you must regenerate the OpenAPI types via `pnpm run generate:types`.

### EventBridge patterns — REQUIRED

- Custom event bus per project (configured in `mantle.config.ts`)
- Use `emitEvent()` and `emitEvents()` from `@mantleframework/core` to publish events — these wrap `putEvents` from `@mantleframework/aws` with retry and fire-and-forget error handling
- Fire-and-forget by default: errors caught and logged, not propagated. Pass `fireAndForget: false` to re-throw on failure.
- `exportToS3` from `@mantleframework/aws` for data exports to S3

---

## Type Naming

### Conventions — REQUIRED

| Pattern | Usage | Example |
|---------|-------|---------|
| `*Row` | Drizzle select results | `FileRow`, `UserRow` |
| `*Item` | Rows with joins/enrichment | `UserItem`, `FileItem` |
| `*Input` | Request payloads / mutation inputs | `SyncInput`, `CreateFileInput` |
| `*Response` | API response wrappers | `ListFilesResponse` |
| `*Error` | Error classes | `DatabaseError`, `ValidationError` |
| Simple nouns | Domain entities | `User`, `File`, `Device` |

Enum values use PascalCase: `FileStatus.Downloaded`, `UserStatus.Authenticated`.

---

## OpenTofu Naming Conventions

Following the [HashiCorp style guide](https://developer.hashicorp.com/terraform/language/style), [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/terraform-aws-provider-best-practices/structure.html), and [TFLint conventions](https://github.com/terraform-linters/tflint-ruleset-terraform/blob/main/docs/rules/terraform_naming_convention.md), **all HCL identifiers use `snake_case`**. PascalCase is reserved for AWS resource `name` attribute values (the human-visible strings), not for Terraform identifiers.

### Resource identifiers — REQUIRED

All resource identifiers (the label after the resource type) use **snake_case**. Mantle CLI auto-generates these via `toSnakeCase()`.

```hcl
module "lambda_health_sync"    { source = "../../mantle/modules/lambda" ... }
module "lambda_books_get"      { source = "../../mantle/modules/lambda" ... }
module "lambda_export_health"  { source = "../../mantle/modules/lambda" ... }
```

For projects with explicit resources (not module-wrapped), the same convention applies:

| Resource Type | Identifier Pattern | Example |
|---------------|-------------------|---------|
| Lambda module | `lambda_{snake_case}` | `lambda_health_sync` |
| API Gateway resource | `{snake_case}` route-derived | `health_sync` |
| API Gateway intermediary path | `path_{snake_case}` | `path_books`, `path_health` |
| API Gateway method | `{snake_case}` (no HTTP verb suffix) | `books_get`, `health_sync` |
| API Gateway integration | same as method | `books_get` |
| EventBridge rule | `{lambda_snake}_{detail_type_snake}` | `export_health_data_export_health` |
| EventBridge target | same as rule | `export_health_data_export_health` |

### File naming — REQUIRED

One `.tf` file per Lambda, prefixed with `lambda_` and named in **snake_case**:

| File | Lambda |
|------|--------|
| `lambda_health_sync.tf` | `HealthSync` |
| `lambda_books_get.tf` | `BooksGet` |
| `lambda_export_health_data.tf` | `ExportHealthData` |
| `lambda_migrate_dsql.tf` | `MigrateDSQL` |

Shared infrastructure files are snake_case by concern: `main.tf`, `variables.tf`, `api_routes.tf`, `storage_data.tf`, `websocket_api.tf`.

### AWS resource `name` attributes — REQUIRED

The `name` attribute (the human-visible string in AWS) uses **`${name_prefix}-PascalCase`** where `name_prefix` is `${environment}-${project_name}` (constructed by the core module):

| Resource | `name` Pattern | Example |
|----------|---------------|---------|
| Lambda function | `PascalCase` (module prepends prefix) | `dev-lifegames-portal-HealthSync` |
| EventBridge bus | `${name_prefix}-PascalCase` | `dev-lifegames-portal-LifegamesPortal` |
| EventBridge rule | `${name_prefix}-PascalCase` | `dev-lifegames-portal-ExportHealth` |
| SQS queue | `${name_prefix}-PascalCase` | `dev-lifegames-portal-DownloadQueue` |
| SQS DLQ | base name + `-DLQ` | `dev-lifegames-portal-DownloadQueue-DLQ` |
| CloudWatch log group | `/aws/lambda/${function_name}` | `/aws/lambda/dev-lifegames-portal-HealthSync` |
| S3 bucket | all-lowercase hyphenated (S3 requirement) | `lifegames-dev-media-files` |

### Module structure — REQUIRED

Mantle-based projects use the **module-wrapped** pattern. Each Lambda is a single `module` block sourcing `mantle/modules/lambda`. IAM roles, log groups, permissions, and the `aws_lambda_function` resource live inside the module — not in per-Lambda files.

```hcl
module "lambda_health_sync" {
  source        = "../../mantle/modules/lambda"
  function_name = "HealthSync"
  source_dir    = "${path.module}/../build/lambdas/HealthSync"
  # ... environment_variables, inline_policies, etc.
}
```

### Locals, variables, outputs — REQUIRED

All use **snake_case**, following the universal Terraform convention:

```hcl
# Locals
locals {
  lambda_dsql_roles = { "HealthSync" = "lambda_health_sync", ... }
}

# Variables
variable "project_name" { ... }
variable "log_retention_days" { ... }

# Outputs
output "api_gateway_subdomain" { ... }
output "dsql_cluster_endpoint" { ... }
```

### API Gateway path parts — REQUIRED

The `path_part` attribute is always **lowercase**. The resource identifier is **snake_case** with `path_` prefix for intermediary segments:

```hcl
resource "aws_api_gateway_resource" "path_health"  { path_part = "health" }
resource "aws_api_gateway_resource" "health_sync"   { path_part = "sync" }   # child of path_health
resource "aws_api_gateway_resource" "path_books"    { path_part = "books" }
```

### PostgreSQL role names (DSQL) — REQUIRED

PostgreSQL role names for Lambda-scoped DB access use `lambda_{snake_case}`:

```
lambda_health_sync      → HealthSync Lambda
lambda_export_health    → ExportHealthData Lambda
admin                   → MigrateDSQL (uses built-in DSQL admin)
```

---

## Security

### PII sanitization — REQUIRED

All logging MUST pass through `sanitizeData()` with `DEFAULT_SENSITIVE_PATTERNS`. See Observability section.

### No committed secrets — REQUIRED

No plaintext secrets in source. Environment variables with secrets (`API_BEARER_TOKEN`, API keys) are injected via Terraform variables, never hardcoded.

### IAM database authentication — REQUIRED

Aurora DSQL uses IAM-based token authentication via `DsqlSigner`. No database passwords stored anywhere.

### Secrets management — REQUIRED

**SOPS + age encryption** is the standard for projects with automated CI/CD deployment.

#### When SOPS is required

Any project where CI deploys to AWS (i.e., GitHub Actions runs `tofu apply`). Secrets are encrypted at rest in git, decryptable only with the age private key stored as a GitHub Actions secret (`SOPS_AGE_KEY`). This ensures:
- Secrets are version-controlled with full audit trail
- No manual `terraform.tfvars` to sync across machines
- CI can deploy without human intervention

#### SOPS setup

| Component | Convention |
|-----------|-----------|
| Config file | `.sops.yaml` at repo root — one `creation_rule` per environment |
| Encryption backend | `age` (not AWS KMS, not PGP) |
| Encrypted files | `secrets.{environment}.enc.yaml` at repo root (committed) |
| Plaintext files | `secrets.{environment}.yaml` (gitignored) |
| Terraform provider | `carlpett/sops` — `data "sops_file" "secrets"` data source |
| CI decryption | Write `SOPS_AGE_KEY` secret to file → `sops --decrypt` → set `SOPS_AGE_KEY_FILE` env var |
| Runtime delivery | Secrets flow from `data.sops_file.secrets.data["key.path"]` → Lambda environment variables |

#### When gitignored `terraform.tfvars` is acceptable

Projects with **manual-only deployment** (no CI deploy step) may use a gitignored `terraform.tfvars` with `sensitive = true` on variables. The Mantle CLI auto-marks variables matching `/key|token|secret/i` as sensitive. This approach works for solo developers running `tofu apply` locally, but does not scale to CI or multi-developer workflows.

---

## Infrastructure (OpenTofu)

### OpenTofu (not Terraform) — REQUIRED

All infrastructure uses OpenTofu. Current versions (as of March 2026):

```hcl
terraform {
  required_version = "~> 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.37"
    }
    sops = {
      source  = "carlpett/sops"
      version = "~> 1.4"
    }
  }
}
```

| Component | Version | Constraint |
|-----------|---------|-----------|
| OpenTofu | 1.11.x | `~> 1.11` |
| AWS provider | 6.37.x | `~> 6.37` |
| SOPS provider | 1.4.x | `~> 1.4` (only for projects using SOPS) |

### Resource tagging — REQUIRED

All resources MUST have these tags (via the core module):
- `ManagedBy = "opentofu"`
- `Project = var.project_name`
- `Environment = var.environment`

### Per-Lambda Terraform pattern — REQUIRED

One `.tf` file per Lambda containing:
- IAM role + scoped CloudWatch Logs policy
- CloudWatch log group with retention
- Lambda function with `source_code_hash` for change detection
- Trigger resources (API Gateway, EventBridge rule, SQS, etc.)

### Module sourcing — REQUIRED

Instance repos source infrastructure modules from `mantle/modules/`:
```hcl
module "core"        { source = "../../mantle/modules/core" }
module "api"         { source = "../../mantle/modules/api-gateway" }
module "lambda"      { source = "../../mantle/modules/lambda" }
module "database"    { source = "../../mantle/modules/database/aurora-dsql" }
module "eventbridge" { source = "../../mantle/modules/eventbridge" }
```

### Resource renaming — REQUIRED

Use `moved {}` blocks when renaming Lambda resources in Terraform to avoid destroy/recreate cycles.

### esbuild target — REQUIRED

esbuild `target` must match the Lambda runtime. Use `node24` (not `esYYYY` format). The Mantle CLI sets this in `packages/cli/src/build/bundler.ts`.

---

## Git & Version Control

### Git hooks — REQUIRED

Husky for pre-commit hooks. Pre-commit workflow order:
1. `typecheck` (tsc --noEmit)
2. `lint` (ESLint)
3. `format:check` (dprint check)
4. `test` (Vitest)

### Commit message style — REQUIRED

All repositories use **conventional commits** (`type(scope): description`). This enables automated changelog generation, structured git log filtering, and consistent commit history across all projects.

**Types:** `feat`, `fix`, `chore`, `refactor`, `test`, `style`, `ci`, `docs`, `perf`, `revert`

**Scopes:** parenthesized and specific to the area of change, e.g., `(lambda)`, `(auth)`, `(db)`, `(entities)`, `(infra)`, `(build)`, `(deps)`

**Examples:**
```
feat(entities): add native Drizzle query modules for database migration
fix(lambda): increase RegisterDevice timeout to 10 seconds
chore(deps): remove deprecated type stub packages
refactor(auth): extract session validation to service layer
test: comprehensive test gap remediation
ci: enforce dprint formatting in CI workflow
docs: update CLAUDE.md for handler factory pattern
```

**No AI attribution** in commit messages — do not include `Co-Authored-By` lines referencing AI tools.

### Changeset versioning — REQUIRED (framework only)

Mantle uses `@changesets/cli` for version management of `@mantleframework/*` packages. Instance repos do not need changesets.

### Release tags — INFORMATIONAL

No repositories currently use git tags for releases. This may change as the framework matures.

---

## CI/CD

### GitHub Actions — REQUIRED

All repos use GitHub Actions with parallel jobs:

| Job | Command | Required |
|-----|---------|----------|
| `typecheck` | `tsc --noEmit` | Yes |
| `lint` | ESLint + dprint check | Yes |
| `test` | Vitest (unit tests) | Yes |
| `build` | unbuild / esbuild | Yes |
| `integration-test` | Vitest (integration, conditional) | On main branch or labeled PRs |
| `conventions` | `mantle check --severity HIGH` | Yes (instance repos) |

All jobs use `pnpm install --frozen-lockfile` and `node-version-file: '.nvmrc'`.

### Dependency auditing — RECOMMENDED

`pnpm audit` for dependency vulnerability scanning. Mantle runs an `audit` CI job.

### Upstream dependency tracking — RECOMMENDED

Create CI/CD workflows on a schedule (e.g., weekly) to monitor upstream dependencies. If an update is found, automatically create a pull request with the updated dependency version.

---

## Documentation

### Source code documentation (TypeDoc) — REQUIRED

Framework and library packages use TypeDoc for API reference documentation (`pnpm docs:api`). Mantle renders TypeDoc output as Markdown into VitePress for a unified docs site.

### HTTP API documentation (OpenAPI) — REQUIRED

Instance backends (projects with HTTP APIs) MUST generate an OpenAPI spec from their Zod schemas. Use `@asteasolutions/zod-to-openapi` for OpenAPI document generation. Run `pnpm run generate:types` after any request/response schema change — this produces the OpenAPI JSON consumed by iOS Swift OpenAPI Generator for type-safe client code.

### JSDoc conventions — REQUIRED

**Philosophy:** TypeScript types serve as documentation. JSDoc provides brief description and "why" context — not type information.

#### What requires JSDoc

| Code | JSDoc Required | Severity |
|------|---------------|----------|
| Exported functions with business logic | Yes | `warn` (general), `error` (Lambda handlers) |
| Interfaces and type aliases | Yes | `warn` |
| Lambda handler entry points | Yes, with file header (Trigger, Input, Output) | `error` |
| Internal helpers | Yes, with `@notExported` tag | `warn` |
| `@packageDocumentation` in barrel `index.ts` | Yes | — |

#### What does NOT require JSDoc (self-documenting)

- AWS vendor wrapper files (`src/lib/vendor/AWS/*.ts`) — thin SDK facades
- Thin wrapper functions (5 lines or fewer)
- Simple utility functions with self-documenting signatures
- Functions with `/* c8 ignore */` comments that already explain purpose
- Re-export barrel files (index.ts with only exports)
- Scripts, tooling, and config files

#### Format

```typescript
/**
 * Brief description of what the function does.
 *
 * Additional context explaining WHY, if needed.
 *
 * @param paramName - Description of parameter
 * @throws {ErrorType} When this error occurs
 * @see {@link https://github.com/.../wiki/PageName | Detailed Examples}
 */
```

#### Rules

| Rule | Setting | Rationale |
|------|---------|-----------|
| `jsdoc/require-jsdoc` | `warn` / `error` for handlers | Enforces presence on exports |
| `jsdoc/no-types` | `error` | Types belong in TypeScript, not JSDoc `{type}` |
| `jsdoc/require-param` | `off` | TypeScript types are sufficient |
| `jsdoc/require-returns` | `off` | TypeScript types are sufficient |
| `jsdoc/require-hyphen-before-param-description` | `warn` | `@param name - Description` (hyphen required) |
| `jsdoc/check-param-names` | `warn` | Catches stale param names |

#### `@example` and `@see` usage

- **Short examples (1-3 lines)**: OK inline in `@example`
- **Longer examples**: Move to wiki, reference with `@see {@link url | Title}`
- **Never** inline examples containing decorators (`@RequiresTable`) or `@mantleframework/*` refs — TSDoc parser chokes on `@` symbols

#### Lambda file headers — REQUIRED

All Lambda handler files (`src/lambdas/*/src/index.ts` or `src/lambdas/**/index.ts`) must have a file-level JSDoc block:

```typescript
/**
 * [LambdaName] Lambda
 *
 * [1-2 sentence description]
 *
 * Trigger: [API Gateway | EventBridge | S3 Event | CloudWatch Schedule]
 * Input: [Brief description of event source]
 * Output: [Brief description of response/effect]
 */
```

See [Code-Comments.md](mantle-OfflineMediaDownloader/docs/wiki/Conventions/Code-Comments.md) for the complete convention reference.

---

## Development Workflow

### Package manager — REQUIRED

pnpm 10+ for all repositories. Use `pnpm install --frozen-lockfile` in CI.

### Bundler — REQUIRED

unbuild for all Lambda bundling. Configure via `build.config.ts` at project root with `rollup: { emitCJS: false }` (ESM only) and appropriate externals (`@aws-sdk/*`, `aws-lambda`).

### Build after framework changes — REQUIRED

Always run `pnpm build` in `mantle/` after making framework changes to propagate to instances.

---

## Convention Enforcement

### `mantle check` CLI — REQUIRED

Instance repos run `mantle check --severity HIGH` to validate conventions. This is enforced in CI as a required job.
- Evidence: `@mantleframework/cli` check command, Lifegames Portal `.github/workflows/ci.yml`

### Convention validation — INFORMATIONAL

Convention validation is handled by `mantle check` which enforces rules across all repos using ts-morph AST analysis.

See per-project CLAUDE.md files for project-specific rule lists.
