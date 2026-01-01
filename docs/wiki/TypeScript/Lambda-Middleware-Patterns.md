# Lambda Middleware Patterns

## Quick Reference
- **When to use**: Building Lambda handlers with consistent behavior
- **Location**: `src/lib/lambda/middleware/`
- **Related**: [Lambda Function Patterns](Lambda-Function-Patterns.md)

## Overview

This project uses middleware wrappers to provide consistent behavior across all Lambda handlers:
- Automatic error handling
- Request/response logging
- Test fixture generation
- User authentication extraction
- Observability integration (X-Ray, Powertools)

---

## Handler Wrappers

### wrapApiHandler

**Use for**: Generic API Gateway handlers without authentication requirements.

**File**: `src/lib/lambda/middleware/api.ts`

**What it provides**:
- Automatic try-catch with `buildApiResponse(context, error)`
- Request/response logging (`logInfo`)
- Test fixture generation (`logIncomingFixture`, `logOutgoingFixture`)
- Trace ID extraction

**Signature**:
```typescript
function wrapApiHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: ApiHandlerParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult>
```

**Example**:
```typescript
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {UnauthorizedError} from '#lib/system/errors'

export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  // Extract what you need from the event
  const {body, headers} = event

  // Validation - just throw on error, wrapper catches it
  if (!body) {
    throw new UnauthorizedError('Request body required')
  }

  // Business logic
  const result = await processRequest(JSON.parse(body))

  // Return success response
  return buildApiResponse(context, 200, result)
}))
```

**Error handling**:
```typescript
// These errors are automatically converted to API responses:

// CustomLambdaError subclasses use their statusCode
throw new UnauthorizedError()           // 401
throw new ValidationError('Bad input')  // 400
throw new NotFoundError('No file')      // 404

// Standard errors become 500
throw new Error('Unexpected failure')   // 500
```

---

### wrapAuthenticatedHandler

**Use for**: API handlers that REQUIRE authentication. Rejects both unauthenticated and anonymous users.

**File**: `src/lib/lambda/middleware/api.ts`

**What it provides**:
- Everything from `wrapApiHandler`
- Extracts `userId` from event (guaranteed non-null)
- Rejects `UserStatus.Unauthenticated` with 401
- Rejects `UserStatus.Anonymous` with 401

**Signature**:
```typescript
function wrapAuthenticatedHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: AuthenticatedApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult>
```

**Example**:
```typescript
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'

export const handler = withPowertools(wrapAuthenticatedHandler(
  async ({event, context, userId}) => {
    // userId is GUARANTEED to be a string - no null checks needed
    // The wrapper already rejected unauthenticated and anonymous users

    const files = await getFilesByUser(userId)
    return buildApiResponse(context, 200, {files})
  }
))
```

**When to use**:
- User-specific operations (get my files, update my settings)
- Actions that modify user data
- Any endpoint that should never work without authentication

---

### wrapOptionalAuthHandler

**Use for**: API handlers that work for BOTH authenticated AND anonymous users.

**File**: `src/lib/lambda/middleware/api.ts`

**What it provides**:
- Everything from `wrapApiHandler`
- Extracts `userId` (may be undefined for anonymous)
- Extracts `userStatus` for conditional logic
- Rejects ONLY `UserStatus.Unauthenticated` (invalid token) with 401
- Allows `UserStatus.Anonymous` (no token) through

**Signature**:
```typescript
function wrapOptionalAuthHandler<TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  handler: (params: OptionalAuthApiParams<TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult>
```

**Example**:
```typescript
import {wrapOptionalAuthHandler} from '#lib/lambda/middleware/api'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {UserStatus} from '#types/enums'
import {getDefaultFile} from '#config/constants'

export const handler = withPowertools(wrapOptionalAuthHandler(
  async ({context, userId, userStatus}) => {
    // Handle anonymous users (no token provided)
    if (userStatus === UserStatus.Anonymous) {
      // Provide demo/sample content
      const demoContent = [getDefaultFile()]
      return buildApiResponse(context, 200, {contents: demoContent})
    }

    // For authenticated users, userId is available
    // Note: cast to string since we've already handled anonymous case
    const files = await getFilesByUser(userId as string)
    return buildApiResponse(context, 200, {contents: files})
  }
))
```

**User status flow**:
```
Token present + valid   → UserStatus.Authenticated → userId available
Token present + invalid → UserStatus.Unauthenticated → 401 (rejected by wrapper)
No token                → UserStatus.Anonymous → userId undefined (allowed)
```

---

### wrapScheduledHandler

**Use for**: CloudWatch scheduled event handlers (cron jobs).

**File**: `src/lib/lambda/middleware/internal.ts`

**What it provides**:
- Event logging
- Result logging
- Error logging and rethrow (for CloudWatch visibility)
- Trace ID extraction

**Signature**:
```typescript
function wrapScheduledHandler<TResult = void>(
  handler: (params: ScheduledHandlerParams) => Promise<TResult>
): (event: ScheduledEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult>
```

**Example**:
```typescript
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {logInfo} from '#lib/system/logging'

export const handler = withPowertools(wrapScheduledHandler(async ({event, context}) => {
  logInfo('Running scheduled task', {
    time: event.time,
    requestId: context.awsRequestId
  })

  // Perform scheduled maintenance
  const prunedCount = await pruneOldRecords()
  const cleanedCount = await cleanupExpiredSessions()

  return {prunedCount, cleanedCount}
}))
```

**Error behavior**: Errors are logged then rethrown. CloudWatch will mark the invocation as failed, triggering any configured alarms.

---

### wrapLambdaInvokeHandler

**Use for**: Handlers invoked by other Lambdas (async invocation pattern).

**File**: `src/lib/lambda/middleware/internal.ts`

**What it provides**:
- Request/response logging
- Test fixture generation
- Error logging and rethrow
- Trace ID extraction

**Signature**:
```typescript
function wrapLambdaInvokeHandler<TEvent, TResult>(
  handler: (params: LambdaInvokeHandlerParams<TEvent>) => Promise<TResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<TResult>
```

**Example**:
```typescript
import {wrapLambdaInvokeHandler} from '#lib/lambda/middleware/internal'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {buildApiResponse} from '#lib/lambda/responses'
import {logDebug} from '#lib/system/logging'

interface StartFileUploadParams {
  fileId: string
  correlationId?: string
}

export const handler = withPowertools(wrapLambdaInvokeHandler<StartFileUploadParams, APIGatewayProxyResult>(
  async ({event, context}) => {
    const {fileId} = event
    logDebug('Processing file', {fileId})

    await downloadAndUploadFile(fileId)

    return buildApiResponse(context, 200, {fileId, status: 'success'})
  }
))
```

**Use case**: The `FileCoordinator` Lambda invokes `StartFileUpload` for each pending download. Using this wrapper ensures consistent logging and error handling across the invocation chain.

---

## Response Building

### buildApiResponse

**Use for**: Creating consistent API Gateway responses.

**File**: `src/lib/lambda/responses.ts`

**Overloads**:
```typescript
// Success with status code and body
buildApiResponse(context, 200, {data: files})

// Error with status code and message
buildApiResponse(context, 404, 'File not found')

// Error from Error object (extracts status and message)
buildApiResponse(context, new ValidationError('Invalid input'))
```

**Response formats**:

Success (2xx):
```json
{
  "body": { "data": [...] },
  "requestId": "abc-123"
}
```

Error (4xx/5xx):
```json
{
  "error": {
    "code": "custom-4XX-generic",
    "message": "File not found"
  },
  "requestId": "abc-123"
}
```

### buildValidatedResponse

**Use for**: Creating API responses with Zod schema validation.

**File**: `src/lib/lambda/responses.ts`

**What it provides**:
- All functionality of `buildApiResponse`
- Schema validation for success responses (2xx)
- In dev/test: throws on validation failure
- In production: logs warning, continues with response

**Signature**:
```typescript
function buildValidatedResponse<T extends string | object>(
  context: Context,
  statusCode: number,
  body: T,
  schema?: z.ZodSchema<T>
): APIGatewayProxyResult
```

**Example**:
```typescript
import {buildValidatedResponse} from '#lib/lambda/responses'
import {fileListResponseSchema} from '#types/api-schema'

export const handler = withPowertools(wrapAuthenticatedHandler(
  async ({context, userId}) => {
    const files = await getFilesByUser(userId)
    // Validates response against schema before returning
    return buildValidatedResponse(context, 200, {files}, fileListResponseSchema)
  }
))
```

**Validation behavior**:
```typescript
// Only validates 2xx responses (success paths)
// Error responses (4xx, 5xx) skip validation

// Environment-dependent behavior:
// NODE_ENV=development → throws ValidationError
// NODE_ENV=test → throws ValidationError
// NODE_ENV=production → logs warning, returns response
// NODE_ENV undefined → logs warning, returns response
```

**When to use**:
- API handlers with TypeSpec-generated response schemas
- Endpoints where response shape must match API contract
- Catching response drift during development/testing

---

## Middleware Composition

Middlewares are composed using function wrapping. The standard pattern:

```typescript
export const handler = withPowertools(    // Outer: observability
  wrapApiHandler(                          // Inner: error handling
    async ({event, context}) => {
      // Your business logic
    }
  )
)
```

**Common compositions**:

| Use Case | Pattern |
|----------|---------|
| API endpoint (public) | `withPowertools(wrapApiHandler(...))` |
| API endpoint (auth required) | `withPowertools(wrapAuthenticatedHandler(...))` |
| API endpoint (auth optional) | `withPowertools(wrapOptionalAuthHandler(...))` |
| Scheduled job | `withPowertools(wrapScheduledHandler(...))` |
| Lambda invocation | `withPowertools(wrapLambdaInvokeHandler(...))` |
| API with validation | `withPowertools(wrapValidatedHandler(schema, ...))` |
| Auth + validation | `withPowertools(wrapAuthenticatedValidatedHandler(schema, ...))` |
| SQS batch processing | `withPowertools(wrapSqsBatchHandler(...))` |

---

## Request Validation Middleware

### wrapValidatedHandler

**Use for**: API handlers that require automatic Zod-based request body validation.

**File**: `src/lib/lambda/middleware/validation.ts`

**What it provides**:
- Automatic JSON body parsing via `getPayloadFromEvent()`
- Zod schema validation with detailed error messages
- Typed body passed to handler
- 400 response on validation failure

**Signature**:
```typescript
function wrapValidatedHandler<TBody, TEvent = CustomAPIGatewayRequestAuthorizerEvent>(
  schema: z.ZodSchema<TBody>,
  handler: (params: ValidatedApiParams<TBody, TEvent>) => Promise<APIGatewayProxyResult>
): (event: TEvent, context: Context, metadata?: WrapperMetadata) => Promise<APIGatewayProxyResult>
```

**Example**:
```typescript
import {wrapValidatedHandler} from '#lib/lambda/middleware/validation'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {z} from 'zod'

const deviceSchema = z.object({
  deviceId: z.string(),
  token: z.string(),
  platform: z.enum(['ios', 'android'])
})

export const handler = withPowertools(
  wrapValidatedHandler(deviceSchema, async ({context, body}) => {
    // body is typed as z.infer<typeof deviceSchema>
    const device = await registerDevice(body.deviceId, body.token, body.platform)
    return buildApiResponse(context, 200, {device})
  })
)
```

---

### wrapAuthenticatedValidatedHandler

**Use for**: API handlers requiring BOTH authentication AND request validation.

**File**: `src/lib/lambda/middleware/validation.ts`

**What it provides**:
- Everything from `wrapAuthenticatedHandler`
- Zod schema validation with typed body
- Authentication checked BEFORE validation

**Example**:
```typescript
import {wrapAuthenticatedValidatedHandler} from '#lib/lambda/middleware/validation'
import {buildApiResponse} from '#lib/lambda/responses'
import {withPowertools} from '#lib/lambda/middleware/powertools'

export const handler = withPowertools(
  wrapAuthenticatedValidatedHandler(deviceSchema, async ({context, userId, body}) => {
    // userId is guaranteed string, body is validated and typed
    const device = await registerDevice(userId, body.deviceId, body.token)
    return buildApiResponse(context, 200, {device})
  })
)
```

---

## SQS Batch Processing

### wrapSqsBatchHandler

**Use for**: SQS event handlers with standardized batch processing and partial failure support.

**File**: `src/lib/lambda/middleware/sqs.ts`

**What it provides**:
- Automatic JSON body parsing per record
- Per-record error handling with failure collection
- Partial batch failure support via `SQSBatchResponse`
- Batch processing statistics logging

**Signature**:
```typescript
function wrapSqsBatchHandler<TBody = unknown>(
  handler: (params: SqsRecordParams<TBody>) => Promise<void>,
  options?: SqsBatchOptions
): (event: SQSEvent, context: Context, metadata?: WrapperMetadata) => Promise<SQSBatchResponse>
```

**Options**:
- `parseBody`: Parse body as JSON (default: `true`)
- `stopOnError`: Stop on first error instead of continuing (default: `false`)

**Example**:
```typescript
import {wrapSqsBatchHandler} from '#lib/lambda/middleware/sqs'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import type {NotificationPayload} from '#types/notification-types'

export const handler = withPowertools(
  wrapSqsBatchHandler<NotificationPayload>(async ({body, messageAttributes}) => {
    const notificationType = messageAttributes.type?.stringValue
    await sendNotification(body, notificationType)
    // Throw to report failure (message returns to queue)
    // Return normally to report success (message deleted)
  })
)
```

**Failure handling**:
```typescript
// Failed message IDs are automatically collected
// Returned in SQSBatchResponse.batchItemFailures
// Failed messages return to queue for retry
// Successful messages are deleted
```

---

## Middy Middleware

### sanitizeInput

**Use for**: XSS/injection protection for request bodies.

**File**: `src/lib/lambda/middleware/sanitization.ts`

**What it provides**:
- Removes script tags and event handlers
- Strips JavaScript/VBScript URLs
- Removes iframe injection attempts
- Strips control characters
- Configurable field skipping (for passwords, tokens)
- Optional string length limiting

**Example**:
```typescript
import middy from '@middy/core'
import {sanitizeInput} from '#lib/lambda/middleware/sanitization'
import {wrapApiHandler} from '#lib/lambda/middleware/api'

export const handler = middy(wrapApiHandler(async ({event, context}) => {
  // Body is already sanitized
  const body = getPayloadFromEvent(event)
  return buildApiResponse(context, 200, body)
})).use(sanitizeInput({
  skipFields: ['token', 'password'],
  maxLength: 10000
}))
```

---

### securityHeaders

**Use for**: Adding CORS and security headers to all responses.

**File**: `src/lib/lambda/middleware/security-headers.ts`

**What it provides**:
- Default CORS headers (configurable)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Cache-Control: no-store`
- Optional Content-Security-Policy
- Custom headers support

**Example**:
```typescript
import middy from '@middy/core'
import {securityHeaders} from '#lib/lambda/middleware/security-headers'
import {wrapApiHandler} from '#lib/lambda/middleware/api'

export const handler = middy(wrapApiHandler(async ({event, context}) => {
  return buildApiResponse(context, 200, {data: 'result'})
})).use(securityHeaders({
  corsOrigins: ['https://app.example.com'],
  frameOptions: 'SAMEORIGIN'
}))
```

**Default headers**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Correlation-Id
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cache-Control: no-store
```

---

## Test Fixtures

The middleware wrappers automatically generate test fixtures when `FIXTURE_LOGGING=true`:

```typescript
// In middleware
logIncomingFixture(event)   // Captures incoming event
logOutgoingFixture(result)  // Captures response

// Fixtures are sanitized via sanitizeData() to remove PII
```

**PII Protection**:
```typescript
// sanitizeData() redacts sensitive fields:
const sanitized = sanitizeData({
  email: 'user@example.com',
  token: 'secret123',
  safeField: 'visible'
})
// Returns: { email: '[REDACTED]', token: '[REDACTED]', safeField: 'visible' }
```

See [PII Protection](../TypeScript/PII-Protection.md) for the full list of redacted fields.

---

## Decision Tree

```
Is this a scheduled CloudWatch event?
├─ Yes → wrapScheduledHandler
└─ No
   └─ Is this invoked by another Lambda?
      ├─ Yes → wrapLambdaInvokeHandler
      └─ No (API Gateway)
         └─ Does this require authentication?
            ├─ Always → wrapAuthenticatedHandler
            ├─ Optional → wrapOptionalAuthHandler
            └─ Never → wrapApiHandler
```

---

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler structure conventions
- [Error Handling](TypeScript-Error-Handling.md) - CustomLambdaError hierarchy
- [Jest ESM Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Testing these wrappers

---

*Remember: Use the appropriate wrapper for your use case. The wrapper handles boilerplate so your handler can focus on business logic.*
