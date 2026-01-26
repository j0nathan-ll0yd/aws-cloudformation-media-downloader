# Lambda Function Patterns

## Quick Reference
- **When to use**: Writing AWS Lambda functions
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Inconsistent structure

## Import Order (STRICT)

```typescript
// 1. AWS Lambda types
import {APIGatewayProxyResult, Context} from 'aws-lambda'

// 2. Entity query functions
import {getFile, updateFile} from '#entities/queries'

// 3. Vendor libraries
import {uploadToS3} from '#lib/vendor/AWS/S3'

// 4. Type imports
import type {FileRow} from '#entities/queries'

// 5. Utilities
import {logInfo} from '#lib/system/logging'
import {buildValidatedResponse} from '#lib/lambda/responses'

// ❌ NEVER import AWS SDK directly - use vendor wrappers
```

## Handler Pattern

Lambda handlers use wrapper functions that eliminate boilerplate and ensure consistency:

```typescript
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {buildValidatedResponse} from '#lib/lambda/responses'

// Helper functions first
async function processFile(fileId: string): Promise<void> {
  const file = await getFile(fileId)
  // Process...
}

// Handler with wrappers - business logic only, no try-catch needed
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  await processFile(event.fileId)
  return buildValidatedResponse(context, 200, {success: true})
  // Errors automatically converted to 500 responses
}))
```

### Available Handler Wrappers

| Wrapper | Use Case | Error Handling |
|---------|----------|----------------|
| `wrapApiHandler` | Public API endpoints | Catches errors → 500 response |
| `wrapAuthenticatedHandler` | Auth-required endpoints | Rejects Unauthenticated + Anonymous → 401 |
| `wrapOptionalAuthHandler` | Mixed auth endpoints | Rejects only Unauthenticated → 401 |
| `wrapAuthorizer` | API Gateway authorizers | Propagates `Error('Unauthorized')` → 401 |
| `wrapEventHandler` | S3 event processing | Per-record error handling |
| `wrapSqsBatchHandler` | SQS batch processing | Per-record errors → batchItemFailures |
| `wrapScheduledHandler` | CloudWatch scheduled events | Logs and rethrows errors |
| `wrapLambdaInvokeHandler` | Lambda-to-Lambda invocation | Logs and rethrows errors |

All wrappers provide:
- Automatic request logging via `logIncomingFixture()` (compact summary ~150 bytes)
- Fixture logging for test data extraction
- `WrapperMetadata` with traceId passed to handler

## Database Permissions Decorator

Lambda handlers that access the database must declare their permissions using the `@RequiresDatabase` decorator. This enables:
- **Documentation**: Database access requirements visible in code
- **Validation**: MCP rule ensures declared permissions match actual query usage
- **Generation**: Automated Terraform and PostgreSQL role generation

### Basic Usage

```typescript
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import {AuthenticatedHandler, RequiresDatabase} from '#lib/lambda/handlers'

@RequiresDatabase([
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]},
  {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}
])
class ListFilesHandler extends AuthenticatedHandler<ListFilesResponse> {
  // Handler implementation
}
```

See [Database Permissions](../Infrastructure/Database-Permissions.md) for complete documentation.

## Infrastructure Permission Decorators

In addition to `@RequiresDatabase`, Lambda handlers can declare other infrastructure dependencies using class decorators:

| Decorator | Purpose | Usage |
|-----------|---------|-------|
| `@RequiresSecrets` | Secrets Manager/Parameter Store dependencies | Declare secret access requirements |
| `@RequiresServices` | AWS service dependencies (S3, SQS, SNS, EventBridge) | Declare service access requirements |
| `@RequiresEventBridge` | EventBridge event patterns | Declare published/subscribed events |

### Example: Multiple Decorators

```typescript
import {RequiresDatabase, RequiresEventBridge, RequiresServices, SqsHandler} from '#lib/lambda/handlers'
import {AWSService, EventBridgeOperation, S3Operation, SQSOperation} from '#types/servicePermissions'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'

@RequiresDatabase([
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]},
  {table: DatabaseTable.FileDownloads, operations: [DatabaseOperation.Select, DatabaseOperation.Insert]}
])
@RequiresServices([
  {service: AWSService.S3, resource: 'media-bucket/*', operations: [S3Operation.HeadObject, S3Operation.PutObject]},
  {service: AWSService.SQS, resource: 'notification-queue', operations: [SQSOperation.SendMessage]}
])
@RequiresEventBridge({
  publishes: ['DownloadCompleted', 'DownloadFailed']
})
class StartFileUploadHandler extends SqsHandler {
  // handler implementation
}
```

See [Lambda Decorators](../Infrastructure/Lambda-Decorators.md) for complete documentation.

### Available Tables

| Enum Value | Table Name |
|------------|------------|
| `DatabaseTable.Users` | users |
| `DatabaseTable.Files` | files |
| `DatabaseTable.FileDownloads` | file_downloads |
| `DatabaseTable.Devices` | devices |
| `DatabaseTable.Sessions` | sessions |
| `DatabaseTable.Accounts` | accounts |
| `DatabaseTable.VerificationTokens` | verification_tokens |
| `DatabaseTable.UserFiles` | user_files |
| `DatabaseTable.UserDevices` | user_devices |

### Available Operations

| Enum Value | PostgreSQL |
|------------|------------|
| `DatabaseOperation.Select` | SELECT |
| `DatabaseOperation.Insert` | INSERT |
| `DatabaseOperation.Update` | UPDATE |
| `DatabaseOperation.Delete` | DELETE |

### Access Level Computation

The decorator automatically computes an access level:
- **readonly**: Only SELECT operations declared
- **readwrite**: Any INSERT, UPDATE, or DELETE operations
- **admin**: All operations on 5+ tables (MigrateDSQL only)

### Build-Time Scripts

```bash
# Extract permissions from decorators to JSON
pnpm run extract:db-permissions

# Generate PostgreSQL IAM GRANT migration
pnpm run generate:db-roles-migration

# Validate Terraform matches declared permissions
pnpm run generate:terraform-permissions
```

### Enforcement

| Rule | Method | Severity |
|------|--------|----------|
| Handlers with entity imports must have decorator | MCP `database-permissions` | HIGH |
| Declared tables must cover all imported queries | MCP `database-permissions` | HIGH |
| Terraform access levels must match | `generate:terraform-permissions` | HIGH |

### Powertools Wrapper

```typescript
// Cold start and custom metrics are auto-tracked for ALL lambdas
export const handler = withPowertools(wrapAuthorizer(...))
```

**Cold Start Tracking**: All lambdas automatically track cold start metrics.

**Custom Metrics**: Simply use `metrics.addMetric()` - metrics are auto-flushed when present:

```typescript
import {metrics, MetricUnit} from '#lib/lambda/middleware/powertools'

// Simple metric (no dimensions)
metrics.addMetric('FilesProcessed', MetricUnit.Count, filesProcessed)

// Metric with unique dimensions (use singleMetric)
const m = metrics.singleMetric()
m.addDimension('Category', classification.category)
m.addMetric('RetryScheduled', MetricUnit.Count, 1)
```

**Why Powertools?** EMF logs have zero latency vs CloudWatch API calls (~50-100 ms).
Metrics are batched and flushed automatically by the middleware at request end.

## Response Format (REQUIRED)

**Mandatory**: ALWAYS use the `buildValidatedResponse` helper function from `#lib/lambda/responses`. Never return raw API Gateway response objects.

```typescript
import {buildValidatedResponse, buildErrorResponse} from '#lib/lambda/responses'

// ✅ CORRECT - Use buildValidatedResponse for success
return buildValidatedResponse(context, 200, {
  data: result,
  requestId: context.awsRequestId
})

// ✅ CORRECT - Use buildErrorResponse for errors
return buildErrorResponse(context, error)

// ❌ WRONG - Never return raw objects
return {
  statusCode: 200,
  body: JSON.stringify(data),
  headers: {'Content-Type': 'application/json'}
}
```

**Why**: Ensures consistent response formatting, headers, and error handling across all Lambda functions.

## Common Patterns

## No Underscore-Prefixed Unused Variables (CRITICAL)

**Rule**: Never use underscore-prefixed variables (`_event`, `_context`, `_metadata`) to suppress unused variable warnings.

**Why**: Per AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused `_vars`." This pattern hides poor API design and creates maintenance debt.

**Solution**: Use object destructuring to extract only the properties you need:

```typescript
// ❌ WRONG - Underscore-prefixed unused parameters
export const handler = wrapApiHandler(async (event, context, _metadata) => {
  // _metadata is unused but accepted to satisfy signature
})

// ✅ CORRECT - Object destructuring extracts only what's needed
export const handler = wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  // Only event and context are destructured
})
```

**Enforcement**: MCP `config-enforcement` rule validates that ESLint config doesn't allow underscore-prefixed variables.

### Public API Gateway Handler
```typescript
import type {ApiHandlerParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {buildValidatedResponse} from '#lib/lambda/responses'

// Public endpoints - no authentication required
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  // Business logic - just throw errors, wrapper handles conversion
  return buildValidatedResponse(context, 200, {data: result})
}))
```

### Authenticated API Gateway Handler (PREFERRED)
```typescript
import type {AuthenticatedApiParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {buildValidatedResponse} from '#lib/lambda/responses'

// Authenticated endpoints - userId guaranteed by wrapper
// Rejects both Unauthenticated AND Anonymous users with 401
export const handler = withPowertools(wrapAuthenticatedHandler(async ({context, userId}: AuthenticatedApiParams) => {
  // userId is guaranteed to be a string - no need to check
  await deleteUser(userId)
  return buildValidatedResponse(context, 204)
}))
```

### Optional Auth API Gateway Handler
```typescript
import type {OptionalAuthApiParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {buildValidatedResponse} from '#lib/lambda/responses'
import {UserStatus} from '#types/enums'

// Optional auth endpoints - allows anonymous but rejects invalid tokens
// Rejects only Unauthenticated (invalid token) with 401
// Anonymous users (no token) are allowed
export const handler = withPowertools(wrapOptionalAuthHandler(async ({context, userId, userStatus}: OptionalAuthApiParams) => {
  if (userStatus === UserStatus.Anonymous) {
    return buildValidatedResponse(context, 200, {demo: true})
  }
  // userId is defined when Authenticated
  return buildValidatedResponse(context, 200, {userId})
}))
```

### API Gateway Authorizer
```typescript
import type {AuthorizerParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthorizer} from '#lib/lambda/middleware/legacy'

export const handler = withPowertools(wrapAuthorizer(async ({event}: AuthorizerParams) => {
  // Throw Error('Unauthorized') for 401 response
  if (!isValid) throw new Error('Unauthorized')
  return generateAllow(userId, event.methodArn)
}))
```

### S3 Event Handler
```typescript
import type {EventHandlerParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapEventHandler, s3Records} from '#lib/lambda/middleware/legacy'

// Process individual records - errors don't stop other records
async function processS3Record({record}: EventHandlerParams<S3EventRecord>) {
  const key = record.s3.object.key
  await processFile(key)
}

export const handler = withPowertools(wrapEventHandler(processS3Record, {getRecords: s3Records}))
```

### SQS Batch Handler
```typescript
import type {SqsRecordParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapSqsBatchHandler} from '#lib/lambda/middleware/sqs'

// Process individual records - errors tracked for partial batch failure
async function processRecord({record, body}: SqsRecordParams<MessageType>): Promise<void> {
  // body is automatically parsed JSON (unless parseBody: false)
  await handleMessage(body)
}

export const handler = withPowertools(wrapSqsBatchHandler(processRecord))
```

**SQS Batch Features:**
- Returns `SQSBatchResponse` with `batchItemFailures` for partial batch failure support
- Automatic JSON body parsing (disable with `{parseBody: false}` for raw string body)
- Per-record correlation ID extraction from message attributes
- Failed records are retried by SQS without reprocessing successful records

### Scheduled Event Handler
```typescript
import type {ScheduledHandlerParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'

export const handler = withPowertools(wrapScheduledHandler(async ({}: ScheduledHandlerParams) => {
  // Scheduled task logic - errors propagate to CloudWatch
  await pruneOldRecords()
  return {pruned: count}
}))

## Environment Variable Handling

### Lazy Evaluation (Default Pattern)
**Rule**: Environment variables should be read inside functions, not at module scope.

```typescript
// ✅ CORRECT - Read inside function (lazy evaluation)
async function processFile() {
  const bucketName = getRequiredEnv('BUCKET_NAME')
  // ...
}

// ❌ WRONG - Module-level read (breaks test setup)
const BUCKET_NAME = getRequiredEnv('BUCKET_NAME')  // Throws before tests can mock
```

**Why**: Module-level reads execute at import time, before test mocks can be configured.

### Acceptable Exceptions

**AWS Powertools initialization** (`src/lib/vendor/Powertools/index.ts`) uses module-level env reads:

```typescript
// Acceptable - has fallback values, required for framework initialization
export const logger = new Logger({
  serviceName: process.env['AWS_LAMBDA_FUNCTION_NAME'] || 'MediaDownloader',
  logLevel: (process.env['LOG_LEVEL'] as LogLevel) || 'INFO'
})
```

This is acceptable because:
1. All reads have fallback values (won't throw if missing)
2. Powertools requires initialization at import time for tracing to work correctly
3. Refactoring would require updating all handler imports with minimal benefit

### Helper Functions

```typescript
import {getRequiredEnv, getOptionalEnv, getOptionalEnvNumber} from '#lib/system/env'

// Required - throws if missing
const apiKey = getRequiredEnv('API_KEY')

// Optional with default
const host = getOptionalEnv('APNS_HOST', 'api.sandbox.push.apple.com')

// Optional numeric with default
const batchSize = getOptionalEnvNumber('BATCH_SIZE', 5)
```

## Enforcement

| Rule | Method | Severity |
|------|--------|----------|
| All handlers must use `withPowertools()` | ESLint `local-rules/enforce-powertools` | HIGH |
| Import order must follow pattern | ESLint `local-rules/import-order` | MEDIUM |
| `singleMetric()` required for unique dimensions | MCP `powertools-metrics` | MEDIUM |

### Exceptions

**Lambda@Edge (CloudfrontMiddleware)**: Cannot use Powertools or handler wrappers due to:
- Bundle size constraints (~1 MB limit for Lambda@Edge)
- No X-Ray SDK support at edge locations
- Documented exception in `src/lambdas/CloudfrontMiddleware/src/index.ts:15-16`

## Best Practices

✅ Use `withPowertools` wrapper for all Lambda handlers (provides logging, cold start tracking, tracing)
✅ Use appropriate handler wrapper (`wrapApiHandler`, `wrapAuthenticatedHandler`, etc.)
✅ Use vendor wrappers for AWS SDK (never import AWS SDK directly)
✅ Return responses using `buildValidatedResponse()` helper
✅ Throw errors instead of manual try-catch (wrapper handles it)
✅ Keep handler at bottom of file
✅ Define record processing functions separately for event handlers
✅ Read environment variables inside functions, not at module scope
✅ Cold start metrics are tracked automatically for all lambdas
✅ Custom metrics are auto-flushed when present (no configuration needed)

## Testing

```typescript
// Mock all dependencies first
vi.mock('#lib/vendor/AWS/S3', () => ({
  createS3Upload: vi.fn()
}))

// Import handler after mocks
const {handler} = await import('../src/index')

test('processes file', async () => {
  const result = await handler(mockEvent, mockContext)
  expect(result.statusCode).toBe(200)
})
```

---

## Authentication Helpers

Utilities for Bearer token extraction in `src/lib/lambda/auth-helpers.ts`.

### Extract Required Token

```typescript
import {extractBearerToken} from '#lib/lambda/auth-helpers'

const token = extractBearerToken(event.headers)  // throws if missing
```

### Extract Optional Token

```typescript
import {extractBearerTokenOptional} from '#lib/lambda/auth-helpers'

const token = extractBearerTokenOptional(event.headers)  // null if missing
```

### Validate Format

```typescript
import {isValidBearerFormat} from '#lib/lambda/auth-helpers'

isValidBearerFormat('Bearer abc.xyz.123')  // true
```

---

## Related

### ADRs
- [ADR-0006: Lambda Middleware Pattern](../Decisions/0006-lambda-middleware.md) - Decision rationale
- [ADR-0004: Lazy Initialization](../Decisions/0004-lazy-initialization.md) - Environment variable pattern
- [ADR-0007: Error Handling](../Decisions/0007-error-handling-types.md) - Error patterns by type

### Patterns
- [X-Ray Integration](../AWS/X-Ray-Integration.md) - Tracing via ADOT layer
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging
- [Error Handling](TypeScript-Error-Handling.md)
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md)

---

*Consistent Lambda structure: imports → helpers → handler with Powertools wrapper.*