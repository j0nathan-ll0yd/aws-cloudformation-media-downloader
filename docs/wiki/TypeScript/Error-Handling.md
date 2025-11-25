# Error Handling

## Quick Reference
- **When to use**: All Lambda functions and error-prone operations
- **Enforcement**: Required - consistent error handling across all functions
- **Impact if violated**: HIGH - Poor user experience, inconsistent error responses

## Overview

Different Lambda invocation types require different error handling strategies. API Gateway Lambdas must return proper HTTP responses, while event-driven Lambdas should throw errors for retry logic.

## The Rules

### API Gateway Lambdas: Always Return Response

**NEVER throw errors in API Gateway Lambda handlers.**

API Gateway Lambdas must ALWAYS return a well-formed response object, even for errors. Throwing an error returns a 502 Bad Gateway to the client.

### Event-Driven Lambdas: Throw Errors for Retries

**DO throw errors in event-driven Lambdas.**

Event-driven Lambdas (SNS, SQS, EventBridge) should throw errors to trigger automatic retries and DLQ processing.

## Examples

### ✅ Correct - API Gateway Error Handling (from ListFiles)

```typescript
// src/lambdas/ListFiles/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {lambdaErrorResponse, response, getUserDetailsFromEvent, logInfo, generateUnauthorizedError} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {UserStatus} from '../../../types/enums'

export const handler = withXRay(async (event: CustomAPIGatewayRequestAuthorizerEvent, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  const {userId, userStatus} = getUserDetailsFromEvent(event)

  // Return 401 for unauthenticated users
  if (userStatus == UserStatus.Unauthenticated) {
    return lambdaErrorResponse(context, generateUnauthorizedError())
  }

  try {
    const files = await getFilesByUser(userId as string)
    // Return 200 with data
    return response(context, 200, {contents: files, keyCount: files.length})
  } catch (error) {
    // Return error response, don't throw
    return lambdaErrorResponse(context, error)
  }
})
```

### ✅ Correct - Event-Driven Error Handling (S3ObjectCreated pattern)

```typescript
// src/lambdas/S3ObjectCreated/src/index.ts
import {logError, logInfo} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {S3Event, Context} from 'aws-lambda'

export const handler = withXRay(async (event: S3Event, context: Context, {traceId: _traceId}) => {
  logInfo('S3ObjectCreated triggered', event)

  try {
    // Process S3 event
    for (const record of event.Records) {
      await processS3Record(record)
    }

    // Success - return normally
    return {statusCode: 200}
  } catch (error) {
    logError('Failed to process S3 event', error)

    // Throw to trigger retry/DLQ
    throw error
  }
})
```

### ❌ Incorrect - Throwing in API Gateway Lambda

```typescript
// ❌ WRONG - Throws error, returns 502 to client
export const handler = async (event, context) => {
  const result = await riskyOperation()  // Might throw
  return prepareLambdaResponse({statusCode: 200, body: result})
}

// ❌ WRONG - Throws error instead of returning error response
export const handler = async (event, context) => {
  if (!event.body) {
    throw new Error('Missing body')  // Returns 502!
  }
  // ...
}
```

### ❌ Incorrect - Not Throwing in Event-Driven Lambda

```typescript
// ❌ WRONG - Swallows error, no retry triggered
export const handler = async (event, context) => {
  try {
    await processEvent(event)
  } catch (error) {
    console.error(error)
    return {statusCode: 500}  // Event appears "successful"
  }
}
```

## Input Validation Errors

### API Gateway: Return 400 Bad Request (from RegisterDevice)

```typescript
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerDeviceSchema} from '../../../util/constraints'
import {lambdaErrorResponse, response, verifyPlatformConfiguration} from '../../../util/lambda-helpers'

export const handler = withXRay(async (event, context, {traceId: _traceId}) => {
  let requestBody
  try {
    verifyPlatformConfiguration()
    requestBody = getPayloadFromEvent(event) as DeviceRegistrationRequest
    validateRequest(requestBody, registerDeviceSchema)
  } catch (error) {
    // Validation errors return 400 via lambdaErrorResponse
    return lambdaErrorResponse(context, error)
  }

  try {
    // Continue with valid input
    const device = await registerDevice(requestBody)
    return response(context, 200, {endpointArn: device.endpointArn})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

### Event-Driven: Log and Throw

```typescript
export const handler = withXRay(async (event, context, {traceId}) => {
  const errors = validateInput(event, constraints)
  if (errors) {
    logError(new Error('Invalid event'), {
      context: 'validation',
      errors,
      traceId
    })
    throw new Error('Invalid event structure')
  }
  
  // Continue with valid event
  // ...
})
```

## HTTP Status Codes

Use the `response` helper from lambda-helpers with appropriate status codes:

```typescript
import {response} from '../../../util/lambda-helpers'
import {UnauthorizedError, NotFoundError} from '../../../util/errors'

// 200 - Success with data
return response(context, 200, {contents: files, keyCount: files.length})

// 201 - Created
return response(context, 201, {endpointArn: device.endpointArn})

// 400 - Bad Request (via lambdaErrorResponse with validation error)
throw new BadRequestError('Invalid request parameters')
// lambdaErrorResponse will convert to 400 response

// 401 - Unauthorized (using generateUnauthorizedError)
return lambdaErrorResponse(context, generateUnauthorizedError())

// 403 - Forbidden
throw new ForbiddenError('Access denied')

// 404 - Not Found
throw new NotFoundError('Resource not found')

// 409 - Conflict
throw new ConflictError('Resource already exists')

// 500 - Internal Server Error (default for unknown errors)
return lambdaErrorResponse(context, error)

// 503 - Service Unavailable
throw new ServiceUnavailableError('requires configuration')
```

## Error Logging

Always use `logError` from lambda-helpers:

```typescript
import {logError} from '../../../util/lambda-helpers'

try {
  await operation()
} catch (error) {
  // Log with context
  logError(error, {
    context: 'operation',
    traceId,
    userId: event.userId,
    operation: 'download'
  })
  
  // Handle appropriately for Lambda type
  // ...
}
```

## Rationale

### API Gateway Pattern

1. **Consistent Client Experience** - Clients always get proper HTTP responses
2. **Error Details** - Return meaningful error messages and status codes
3. **No 502 Errors** - Avoid generic "Bad Gateway" responses
4. **Client Debugging** - Status codes help clients understand issues

### Event-Driven Pattern

1. **Automatic Retries** - AWS retries failed events automatically
2. **Dead Letter Queues** - Failed events go to DLQ for investigation
3. **Visibility** - CloudWatch metrics track failure rates
4. **Recovery** - Transient errors can succeed on retry

## Enforcement

### Code Review Checklist

- [ ] API Gateway Lambdas NEVER throw errors
- [ ] API Gateway Lambdas return proper status codes
- [ ] Event-driven Lambdas throw errors on failure
- [ ] All errors logged with `logError()`
- [ ] Input validation returns 400 for API Gateway
- [ ] Error responses include helpful messages

### Testing

```typescript
// Test API Gateway error handling
describe('API Gateway handler', () => {
  it('returns 500 on error, does not throw', async () => {
    mockOperation.mockRejectedValue(new Error('Test error'))
    
    const result = await handler(event, context)
    
    expect(result.statusCode).toBe(500)
    expect(result.body).toContain('error')
    // Test does NOT catch thrown error
  })
})

// Test event-driven error handling
describe('Event-driven handler', () => {
  it('throws on error', async () => {
    mockOperation.mockRejectedValue(new Error('Test error'))
    
    await expect(handler(event, context)).rejects.toThrow()
  })
})
```

## Common Patterns

### Partial Failure in Batch Processing

```typescript
export const handler = withXRay(async (event, context, {traceId}) => {
  const results = []
  const errors = []
  
  for (const record of event.Records) {
    try {
      const result = await processRecord(record)
      results.push(result)
    } catch (error) {
      logError(error, {context: 'record', recordId: record.id, traceId})
      errors.push({recordId: record.id, error: error.message})
    }
  }
  
  if (errors.length > 0) {
    // Log summary
    console.log(`Processed ${results.length} successfully, ${errors.length} failed`)
    
    // Throw to trigger retry of entire batch
    throw new Error(`Batch processing failed: ${errors.length} records`)
  }
  
  return {statusCode: 200, processed: results.length}
})
```

### Retry with Exponential Backoff

```typescript
async function retryOperation(operation: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error  // Final attempt failed
      }
      
      const delay = Math.pow(2, attempt) * 1000  // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler structure
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging
- [X-Ray Integration](../AWS/X-Ray-Integration.md) - Error tracing

---

*Handle errors appropriately for your Lambda invocation type. API Gateway Lambdas return error responses, event-driven Lambdas throw errors for retries.*
