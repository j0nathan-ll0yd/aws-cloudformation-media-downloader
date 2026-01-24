# Error Handling

## Quick Reference
- **When to use**: All Lambda functions and error-prone operations
- **Enforcement**: Required - consistent error handling across all functions
- **Impact if violated**: HIGH - Poor user experience, inconsistent error responses

## The Rules

### API Gateway Lambdas: Use Middleware Error Handling

**Use middleware wrappers that catch thrown errors and convert them to proper API responses.**

API Gateway Lambdas should use `wrapApiHandler`, `wrapAuthenticatedHandler`, or `wrapOptionalAuthHandler` which automatically catch thrown errors and convert them to well-formed API Gateway responses via `buildApiResponse`.

The middleware pattern eliminates try-catch boilerplate from handlers and ensures consistent error response formatting.

### Event-Driven Lambdas: Throw Errors for Retries

**DO throw errors in event-driven Lambdas.**

Event-driven Lambdas (SNS, SQS, EventBridge) should throw errors to trigger automatic retries and DLQ processing.

For SQS Lambdas, use `SQSBatchResponse` with `batchItemFailures` to enable partial batch failures.

## Error Classes

All error classes extend `CustomLambdaError` and include specific error codes:

| Error Class | HTTP Status | Error Code | Usage |
|-------------|-------------|------------|-------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Invalid request data |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Authentication required/failed |
| `ForbiddenError` | 403 | `FORBIDDEN` | Access denied (authenticated but not allowed) |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource not found |
| `UnexpectedError` | 500 | `INTERNAL_ERROR` | Unexpected server errors |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | External service unavailable |
| `CookieExpirationError` | 403 | `COOKIE_EXPIRED` | YouTube cookie expired |

## Examples

### Correct - API Gateway with Middleware

```typescript
// src/lambdas/RefreshToken/src/index.ts
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {UnauthorizedError} from '#lib/system/errors'

export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  const authHeader = event.headers?.Authorization
  if (!authHeader) {
    // Throw error - middleware catches and returns proper 401 response
    throw new UnauthorizedError('Missing Authorization header')
  }

  const result = await processRequest(event)
  return buildApiResponse(context, 200, result)
}))
```

### Correct - Authenticated Handler

```typescript
// src/lambdas/UserDelete/src/index.ts
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthenticatedHandler} from '#lib/lambda/middleware/api'

// wrapAuthenticatedHandler automatically rejects unauthenticated users with 401
export const handler = withPowertools(wrapAuthenticatedHandler(async ({event, context, userId}) => {
  // userId is guaranteed to exist here
  await deleteUserData(userId)
  return buildApiResponse(context, 204)
}))
```

### Correct - SQS with Batch Failure Handling

```typescript
// src/lambdas/SendPushNotification/src/index.ts
import {SQSEvent, SQSBatchResponse} from 'aws-lambda'

export const handler = withPowertools(async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: {itemIdentifier: string}[] = []

  for (const record of event.Records) {
    try {
      await processRecord(record)
    } catch (error) {
      logError('Failed to process record', {messageId: record.messageId, error})
      batchItemFailures.push({itemIdentifier: record.messageId})
    }
  }

  return {batchItemFailures}  // Failed messages will be retried by SQS
})
```

### Incorrect - Not Using Middleware

```typescript
// WRONG - No error handling, would return 502 on error
export const handler = withPowertools(async (event, context) => {
  const result = await riskyOperation()  // If this throws, returns 502!
  return buildApiResponse(context, 200, result)
})

// CORRECT - Use middleware wrapper
export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  const result = await riskyOperation()  // Middleware catches any errors
  return buildApiResponse(context, 200, result)
}))
```

## Input Validation

Use `validateRequest` which throws `ValidationError` automatically:

```typescript
import {getPayloadFromEvent, validateRequest} from '#lib/lambda/middleware/api-gateway'
import {deviceRegistrationRequestSchema} from '#types/api-schema'

export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  const requestBody = getPayloadFromEvent(event)
  validateRequest(requestBody, deviceRegistrationRequestSchema)
  // If validation fails, ValidationError is thrown and middleware returns 400

  const device = await registerDevice(requestBody)
  return buildApiResponse(context, 201, {endpointArn: device.endpointArn})
}))
```

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters"
  },
  "requestId": "abc123-def456"
}
```

The `code` field contains the specific error code from the error class (for example, `VALIDATION_ERROR`, `UNAUTHORIZED`). This enables consistent client-side error handling.

## Error Logging

All errors are automatically logged by `buildApiResponse`. For additional context, use `logError`:

```typescript
import {logError} from '#lib/system/logging'

try {
  await operation()
} catch (error) {
  logError('Operation failed', {context: 'operation', userId})
  throw error  // Re-throw for middleware to handle
}
```

## Enforcement

### Code Review Checklist

- [ ] API Gateway Lambdas use middleware wrappers (`wrapApiHandler`, etc.)
- [ ] Errors are thrown with appropriate error classes (`ValidationError`, `NotFoundError`, etc.)
- [ ] SQS Lambdas return `SQSBatchResponse` for partial failures
- [ ] Event-driven Lambdas throw errors on failure for retries
- [ ] Error classes match the semantic meaning (404 for not found, 503 for external service issues)

---

## Error Classification

Unified error classification in `src/lib/domain/error/`.

### Usage

```typescript
import {classifyError} from '#lib/domain/error'

classifyError(error, 'auth')
classifyError(error, 'database')
classifyError(error, 'external-api', {serviceName: 'GitHub'})
```

---

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler structure
- [Lambda Middleware Patterns](Lambda-Middleware-Patterns.md) - Middleware wrappers
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging

---

*Use middleware wrappers for consistent error handling. Throw appropriate error classes and let middleware convert them to proper API responses.*
