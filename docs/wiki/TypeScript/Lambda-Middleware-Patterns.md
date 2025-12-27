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
