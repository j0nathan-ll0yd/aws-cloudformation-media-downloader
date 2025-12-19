# Error Handling

## Quick Reference
- **When to use**: All Lambda functions and error-prone operations
- **Enforcement**: Required - consistent error handling across all functions
- **Impact if violated**: HIGH - Poor user experience, inconsistent error responses

## The Rules

### API Gateway Lambdas: Always Return Response

**NEVER throw errors in API Gateway Lambda handlers.**

API Gateway Lambdas must ALWAYS return a well-formed response object, even for errors. Throwing an error returns a 502 Bad Gateway to the client.

### Event-Driven Lambdas: Throw Errors for Retries

**DO throw errors in event-driven Lambdas.**

Event-driven Lambdas (SNS, SQS, EventBridge) should throw errors to trigger automatic retries and DLQ processing.

## Examples

### ✅ Correct - API Gateway Error Handling

```typescript
// src/lambdas/ListFiles/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {buildApiResponse, getUserDetailsFromEvent, generateUnauthorizedError} from '../../../util/lambda-helpers'
import {withPowertools} from '../../../util/lambda-helpers'

export const handler = withPowertools(async (event, context): Promise<APIGatewayProxyResult> => {
  const {userId, userStatus} = getUserDetailsFromEvent(event)

  // Return 401 for unauthenticated users
  if (userStatus == UserStatus.Unauthenticated) {
    return buildApiResponse(context, generateUnauthorizedError())
  }

  try {
    const files = await getFilesByUser(userId as string)
    // Return 200 with data
    return buildApiResponse(context, 200, {contents: files, keyCount: files.length})
  } catch (error) {
    // Return error response, don't throw
    return buildApiResponse(context, error as Error)
  }
})
```

### ✅ Correct - Event-Driven Error Handling

```typescript
// src/lambdas/S3ObjectCreated/src/index.ts
import {logError, logInfo} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {S3Event, Context} from 'aws-lambda'

export const handler = withXRay(async (event: S3Event, context: Context, {traceId}) => {
  logInfo('S3ObjectCreated triggered', event)

  try {
    for (const record of event.Records) {
      await processS3Record(record)
    }
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
  return response(context, 200, result)
}

// ❌ WRONG - Throws instead of returning error response
export const handler = async (event, context) => {
  if (!event.body) {
    throw new Error('Missing body')  // Returns 502!
  }
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

### API Gateway: Return 400 Bad Request

```typescript
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {buildApiResponse} from '../../../util/lambda-helpers'

export const handler = withPowertools(async (event, context) => {
  let requestBody
  try {
    requestBody = getPayloadFromEvent(event)
    validateRequest(requestBody, registerDeviceSchema)
  } catch (error) {
    // Validation errors return 400 via buildApiResponse
    return buildApiResponse(context, error as Error)
  }

  try {
    const device = await registerDevice(requestBody)
    return buildApiResponse(context, 200, {endpointArn: device.endpointArn})
  } catch (error) {
    return buildApiResponse(context, error as Error)
  }
})
```

## HTTP Status Codes

Use the `buildApiResponse` helper from lambda-helpers with appropriate status codes:

```typescript
// 200 - Success with data
return buildApiResponse(context, 200, {contents: files})

// 201 - Created
return buildApiResponse(context, 201, {endpointArn: device.endpointArn})

// 400 - Bad Request (via error object)
return buildApiResponse(context, new ValidationError('Invalid parameters'))

// 401 - Unauthorized
return buildApiResponse(context, generateUnauthorizedError())

// 404 - Not Found
return buildApiResponse(context, new NotFoundError('Resource not found'))

// 500 - Internal Server Error
return buildApiResponse(context, error as Error)
```

## Error Logging

Always use `logError` from lambda-helpers:

```typescript
import {logError} from '../../../util/lambda-helpers'

try {
  await operation()
} catch (error) {
  logError(error, {
    context: 'operation',
    traceId,
    userId: event.userId
  })

  // Handle appropriately for Lambda type
}
```

## Enforcement

### Code Review Checklist

- [ ] API Gateway Lambdas NEVER throw errors
- [ ] API Gateway Lambdas return proper status codes
- [ ] Event-driven Lambdas throw errors on failure
- [ ] All errors logged with `logError()`
- [ ] Input validation returns 400 for API Gateway

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler structure
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging

---

*Handle errors appropriately for your Lambda invocation type. API Gateway Lambdas return error responses, event-driven Lambdas throw errors for retries.*
