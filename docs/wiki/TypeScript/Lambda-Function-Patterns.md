# Lambda Function Patterns

## Quick Reference
- **When to use**: Writing AWS Lambda functions
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Inconsistent structure

## Import Order (STRICT)

```typescript
// 1. AWS Lambda types
import {APIGatewayProxyResult, Context} from 'aws-lambda'

// 2. ElectroDB entities
import {Files} from '../../../entities/Files'

// 3. Vendor libraries
import {createS3Upload} from '../../../lib/vendor/AWS/S3'

// 4. Type imports
import type {File} from '../../../types/domain-models'

// 5. Utilities
import {logInfo, response} from '../../../util/lambda-helpers'

// ❌ NEVER import AWS SDK directly - use vendor wrappers
```

## Handler Pattern

Lambda handlers use wrapper functions that eliminate boilerplate and ensure consistency:

```typescript
// Helper functions first
async function processFile(fileId: string): Promise<void> {
  const file = await Files.get({fileId}).go()
  // Process...
}

// Handler with wrappers - business logic only, no try-catch needed
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
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

All wrappers provide:
- Automatic event logging via `logInfo`
- Fixture logging for test data extraction
- `WrapperMetadata` with traceId passed to handler

## Response Format (REQUIRED)

**Mandatory**: ALWAYS use the `response` and `lambdaErrorResponse` helper functions from `lambda-helpers.ts`. Never return raw API Gateway response objects.

```typescript
// ✅ CORRECT - Use response helper
return response(context, 200, {
  data: result,
  requestId: context.awsRequestId
})

// ✅ CORRECT - Use error response helper
return lambdaErrorResponse(context, error)

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
import type {ApiHandlerParams} from '#types/lambda-wrappers'
import {wrapApiHandler, response} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

// Public endpoints - no authentication required
export const handler = withXRay(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  // Business logic - just throw errors, wrapper handles conversion
  return response(context, 200, {data: result})
}))
```

### Authenticated API Gateway Handler (PREFERRED)
```typescript
import type {AuthenticatedApiParams} from '#types/lambda-wrappers'
import {wrapAuthenticatedHandler, response} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

// Authenticated endpoints - userId guaranteed by wrapper
// Rejects both Unauthenticated AND Anonymous users with 401
export const handler = withXRay(wrapAuthenticatedHandler(async ({context, userId}: AuthenticatedApiParams) => {
  // userId is guaranteed to be a string - no need to check
  await deleteUser(userId)
  return response(context, 204)
}))
```

### Optional Auth API Gateway Handler
```typescript
import type {OptionalAuthApiParams} from '#types/lambda-wrappers'
import {wrapOptionalAuthHandler, response} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'
import {UserStatus} from '#types/enums'

// Optional auth endpoints - allows anonymous but rejects invalid tokens
// Rejects only Unauthenticated (invalid token) with 401
// Anonymous users (no token) are allowed
export const handler = withXRay(wrapOptionalAuthHandler(async ({context, userId, userStatus}: OptionalAuthApiParams) => {
  if (userStatus === UserStatus.Anonymous) {
    return response(context, 200, {demo: true})
  }
  // userId is defined when Authenticated
  return response(context, 200, {userId})
}))
```

### API Gateway Authorizer
```typescript
import type {AuthorizerParams} from '#types/lambda-wrappers'
import {wrapAuthorizer} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

export const handler = withXRay(wrapAuthorizer(async ({event}: AuthorizerParams) => {
  // Throw Error('Unauthorized') for 401 response
  if (!isValid) throw new Error('Unauthorized')
  return generateAllow(userId, event.methodArn)
}))
```

### S3 Event Handler
```typescript
import type {EventHandlerParams} from '#types/lambda-wrappers'
import {wrapEventHandler, s3Records} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

// Process individual records - errors don't stop other records
async function processS3Record({record}: EventHandlerParams<S3EventRecord>) {
  const key = record.s3.object.key
  await processFile(key)
}

export const handler = withXRay(wrapEventHandler(processS3Record, {getRecords: s3Records}))
```

### SQS Handler
```typescript
import type {EventHandlerParams} from '#types/lambda-wrappers'
import {wrapEventHandler, sqsRecords} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

// Process individual messages - errors logged but don't stop processing
async function processSQSRecord({record}: EventHandlerParams<SQSRecord>) {
  const body = JSON.parse(record.body)
  await handleMessage(body)
}

export const handler = withXRay(wrapEventHandler(processSQSRecord, {getRecords: sqsRecords}))
```

### Scheduled Event Handler
```typescript
import type {ScheduledHandlerParams} from '#types/lambda-wrappers'
import {wrapScheduledHandler} from '#util/lambda-helpers'
import {withXRay} from '#lib/vendor/AWS/XRay'

export const handler = withXRay(wrapScheduledHandler(async ({}: ScheduledHandlerParams) => {
  // Scheduled task logic - errors propagate to CloudWatch
  await pruneOldRecords()
  return {pruned: count}
}))

## Best Practices

✅ Use `withXRay` wrapper for tracing
✅ Use appropriate handler wrapper (`wrapApiHandler`, `wrapAuthorizer`, etc.)
✅ Use vendor wrappers for AWS SDK (never import AWS SDK directly)
✅ Return responses using `response()` helper
✅ Throw errors instead of manual try-catch (wrapper handles it)
✅ Keep handler at bottom of file
✅ Define record processing functions separately for event handlers

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

- [X-Ray Integration](../AWS/X-Ray-Integration.md)
- [Error Handling](TypeScript-Error-Handling.md)
- [Jest ESM Mocking](../Testing/Jest-ESM-Mocking-Strategy.md)

---

*Consistent Lambda structure: imports → helpers → handler with X-Ray wrapper.*