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
import {logInfo, response} from '#util/lambda-helpers'

// ❌ NEVER import AWS SDK directly - use vendor wrappers
```

## Handler Pattern

Lambda handlers use wrapper functions that eliminate boilerplate and ensure consistency:

```typescript
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {response} from '#util/lambda-helpers'

// Helper functions first
async function processFile(fileId: string): Promise<void> {
  const file = await getFile(fileId)
  // Process...
}

// Handler with wrappers - business logic only, no try-catch needed
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  await processFile(event.fileId)
  return response(context, 200, {success: true})
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
| `wrapEventHandler` | S3/SQS batch processing | Per-record error handling |
| `wrapScheduledHandler` | CloudWatch scheduled events | Logs and rethrows errors |
| `wrapLambdaInvokeHandler` | Lambda-to-Lambda invocation | Logs and rethrows errors |

All wrappers provide:
- Automatic request logging via `logIncomingFixture()` (compact summary ~150 bytes)
- Fixture logging for test data extraction
- `WrapperMetadata` with traceId passed to handler

### Powertools Wrapper Options

```typescript
// Default - cold start metrics tracked automatically for ALL lambdas
export const handler = withPowertools(wrapAuthorizer(...))

// Enable full metrics middleware for lambdas that publish custom metrics
export const handler = withPowertools(wrapScheduledHandler(...), {enableCustomMetrics: true})
```

**Cold Start Tracking**: All lambdas automatically track cold start metrics. For lambdas without
`enableCustomMetrics`, this is done via manual tracking to avoid "No application metrics" warnings.

**Custom Metrics**: Set `enableCustomMetrics: true` for lambdas that publish custom metrics:

```typescript
import {metrics, MetricUnit} from '#lib/lambda/middleware/powertools'

// Simple metric (no dimensions)
metrics.addMetric('FilesProcessed', MetricUnit.Count, filesProcessed)

// Metric with unique dimensions (use singleMetric)
const m = metrics.singleMetric()
m.addDimension('Category', classification.category)
m.addMetric('RetryScheduled', MetricUnit.Count, 1)
```

**Why Powertools?** EMF logs have zero latency vs CloudWatch API calls (~50-100ms).
Metrics are batched and flushed automatically by the middleware at request end.

## Response Format (REQUIRED)

**Mandatory**: ALWAYS use the `buildApiResponse` helper function from `lambda-helpers.ts`. Never return raw API Gateway response objects.

```typescript
// ✅ CORRECT - Use buildApiResponse helper
return buildApiResponse(context, 200, {
  data: result,
  requestId: context.awsRequestId
})

// ✅ CORRECT - Use buildApiResponse for errors
return buildApiResponse(context, error as Error)

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

**Why**: Per AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused `_vars`". This pattern hides poor API design and creates maintenance debt.

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
import {response} from '#util/lambda-helpers'

// Public endpoints - no authentication required
export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  // Business logic - just throw errors, wrapper handles conversion
  return response(context, 200, {data: result})
}))
```

### Authenticated API Gateway Handler (PREFERRED)
```typescript
import type {AuthenticatedApiParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {response} from '#util/lambda-helpers'

// Authenticated endpoints - userId guaranteed by wrapper
// Rejects both Unauthenticated AND Anonymous users with 401
export const handler = withPowertools(wrapAuthenticatedHandler(async ({context, userId}: AuthenticatedApiParams) => {
  // userId is guaranteed to be a string - no need to check
  await deleteUser(userId)
  return response(context, 204)
}))
```

### Optional Auth API Gateway Handler
```typescript
import type {OptionalAuthApiParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {response} from '#util/lambda-helpers'
import {UserStatus} from '#types/enums'

// Optional auth endpoints - allows anonymous but rejects invalid tokens
// Rejects only Unauthenticated (invalid token) with 401
// Anonymous users (no token) are allowed
export const handler = withPowertools(wrapOptionalAuthHandler(async ({context, userId, userStatus}: OptionalAuthApiParams) => {
  if (userStatus === UserStatus.Anonymous) {
    return response(context, 200, {demo: true})
  }
  // userId is defined when Authenticated
  return response(context, 200, {userId})
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
import {wrapEventHandler} from '#lib/lambda/middleware/legacy'
import {s3Records} from '#util/lambda-helpers'

// Process individual records - errors don't stop other records
async function processS3Record({record}: EventHandlerParams<S3EventRecord>) {
  const key = record.s3.object.key
  await processFile(key)
}

export const handler = withPowertools(wrapEventHandler(processS3Record, {getRecords: s3Records}))
```

### SQS Handler
```typescript
import type {EventHandlerParams} from '#types/lambda'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapEventHandler} from '#lib/lambda/middleware/legacy'
import {sqsRecords} from '#util/lambda-helpers'

// Process individual messages - errors logged but don't stop processing
async function processSQSRecord({record}: EventHandlerParams<SQSRecord>) {
  const body = JSON.parse(record.body)
  await handleMessage(body)
}

export const handler = withPowertools(wrapEventHandler(processSQSRecord, {getRecords: sqsRecords}))
```

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
import {getRequiredEnv, getOptionalEnv, getOptionalEnvNumber} from '#util/env-validation'

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
| Custom metrics require `{enableCustomMetrics: true}` | MCP `powertools-metrics` | MEDIUM |
| `singleMetric()` required for unique dimensions | MCP `powertools-metrics` | MEDIUM |

## Best Practices

✅ Use `withPowertools` wrapper for all Lambda handlers (provides logging, cold start tracking, tracing)
✅ Use appropriate handler wrapper (`wrapApiHandler`, `wrapAuthenticatedHandler`, etc.)
✅ Use vendor wrappers for AWS SDK (never import AWS SDK directly)
✅ Return responses using `response()` helper
✅ Throw errors instead of manual try-catch (wrapper handles it)
✅ Keep handler at bottom of file
✅ Define record processing functions separately for event handlers
✅ Read environment variables inside functions, not at module scope
✅ Cold start metrics are tracked automatically for all lambdas (no option needed)
✅ Use `{enableCustomMetrics: true}` only if using Powertools `metrics.addMetric()` API

## Testing

```typescript
// Mock all dependencies first
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn()
}))

// Import handler after mocks
const {handler} = await import('../src/index')

test('processes file', async () => {
  const result = await handler(mockEvent, mockContext)
  expect(result.statusCode).toBe(200)
})
```

## Related Patterns

- [X-Ray Integration](../AWS/X-Ray-Integration.md) - Tracing via ADOT layer
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging
- [Error Handling](TypeScript-Error-Handling.md)
- [Jest ESM Mocking](../Testing/Vitest-Mocking-Strategy.md)

---

*Consistent Lambda structure: imports → helpers → handler with Powertools wrapper.*