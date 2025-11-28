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
import type {DynamoDBFile} from '../../../types/main'

// 5. Utilities
import {logInfo, response} from '../../../util/lambda-helpers'

// ❌ NEVER import AWS SDK directly - use vendor wrappers
```

## Handler Pattern

```typescript
// Helper functions first
async function processFile(fileId: string): Promise<void> {
  const file = await Files.get({fileId}).go()
  // Process...
}

// Handler with X-Ray wrapper at bottom
export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('event <=', event)

  try {
    await processFile(event.fileId)
    return response(context, 200, {success: true})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

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

### API Gateway Handler
```typescript
export const handler = withXRay(async (
  event: APIGatewayProxyEvent,
  context: Context,
  {traceId}
): Promise<APIGatewayProxyResult> => {
  const {userId} = event.requestContext.authorizer
  // Handler logic
})
```

### S3 Event Handler
```typescript
export const handler = withXRay(async (
  event: S3Event,
  context: Context,
  {traceId}
) => {
  for (const record of event.Records) {
    await processS3Object(record.s3)
  }
})
```

### SQS Handler
```typescript
export const handler = withXRay(async (
  event: SQSEvent,
  context: Context,
  {traceId}
) => {
  const results = await Promise.allSettled(
    event.Records.map(record => processMessage(record))
  )
  // Check for failures
})
```

## Best Practices

✅ Use withXRay wrapper for tracing
✅ Log incoming events with `logInfo('event <=', event)`
✅ Use vendor wrappers for AWS SDK
✅ Return proper API Gateway format
✅ Handle errors with lambdaErrorResponse
✅ Keep handler at bottom of file

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