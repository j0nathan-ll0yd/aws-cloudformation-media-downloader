# Lambda Function Style Guide

This document defines the coding standards and patterns for AWS Lambda functions in this project.

## File Structure and Organization

### Import Order (STRICT)

Imports must follow this exact order with blank lines between groups:

```typescript
// 1. AWS Lambda type imports FIRST
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {S3Event, SQSEvent, ScheduledEvent} from 'aws-lambda'  // Event types

// 2. Vendor library imports (lib/vendor/*)
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'

// 3. Type imports (types/*)
import {DynamoDBFile, CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
import {FileStatus, UserStatus} from '../../../types/enums'

// 4. Utility imports (util/*)
import {lambdaErrorResponse, logDebug, logInfo, response, StandardUnit} from '../../../util/lambda-helpers'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {validateRequest} from '../../../util/apigateway-helpers'

// 5. NEVER import AWS SDK directly in Lambda functions
// BAD:
// import {S3Client} from '@aws-sdk/client-s3'
// import {LambdaClient} from '@aws-sdk/client-lambda'
// GOOD: Use vendor wrappers in lib/vendor/AWS/*
```

### Function Organization

1. Helper functions BEFORE handler
2. Handler function ALWAYS at bottom of file
3. All functions must be async (unless returning a simple value)

## Documentation Standards

### JSDoc Comments

- Brief, declarative descriptions (what, not how)
- No implementation details
- Always include `@notExported` tag
- Parameter descriptions explain purpose, not type

```typescript
/**
 * Associates a File to a User in DynamoDB
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 * @notExported
 */
```

### Inline Comments

- AVOID inline comments explaining code
- Only use for non-obvious business logic
- Place above the line, not at end

```typescript
// There will always be 1 result (if the user has a device); but with the possibility of multiple devices
const userDevice = userResponse.Items[0] as DynamoDBUserDevice
```

## Logging Patterns

### Standard Logging Convention

Use the arrow notation consistently:

```typescript
logDebug('functionName <=', inputParams)  // Function input
const result = await someFunction(inputParams)
logDebug('functionName =>', result)  // Function output
```

### Log Levels

- `logInfo`: Handler entry and important state changes
- `logDebug`: AWS service calls and internal function boundaries
- `logError`: Error conditions only

### Handler Entry Logging

```typescript
export async function handler(event: EventType, context: Context) {
  logInfo('event <=', event)  // Always first line
  // ... rest of handler
}
```

## Error Handling Patterns

### API Gateway Lambda Pattern

Separate validation from main logic:

```typescript
export async function handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
  logInfo('event <=', event)
  let requestBody
  try {
    // Input validation ONLY
    requestBody = getPayloadFromEvent(event) as RequestType
    validateRequest(requestBody, schema)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }

  try {
    // Main business logic
    const result = await doSomething()
    return response(context, 200, result)
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
}
```

### Event-Driven Lambda Pattern (S3, SQS, etc.)

Single try-catch or error handling in loops:

```typescript
export async function handler(event: S3Event): Promise<void> {
  logDebug('event', event)
  try {
    const record = event.Records[0]
    // Process record
  } catch (error) {
    assertIsError(error)
    throw new UnexpectedError(error.message)
  }
}
```

### SQS Pattern with Loop Error Handling

```typescript
export async function handler(event: SQSEvent): Promise<void> {
  logDebug('event', event)
  for (const record of event.Records) {
    try {
      // Process individual record
    } catch (error) {
      assertIsError(error)
      logError('processRecord <=', error.message)
      // Continue processing other records
    }
  }
}
```

## Code Patterns

### Environment Variables

Always cast with `as string`:

```typescript
const table = process.env.DynamoDBTableFiles as string
const bucket = process.env.Bucket as string
```

### Early Returns

Use early returns for validation failures and edge cases:

```typescript
if (count === 0) {
  return response(context, 404, "User doesn't exist")
} else if (count > 1) {
  return response(context, 300, 'Duplicate user detected')
}
```

### AWS Service Calls

Always wrap with logging:

```typescript
const params = getUserFilesParams(table, userId)
logDebug('query <=', params)
const response = await query(params)
logDebug('query =>', response)
```

### Error Messages

Use constants from util/errors:

```typescript
throw new UnexpectedError(providerFailureErrorMessage)
```

Never use custom error messages unless specific to business logic.

### Promise Handling

Use Promise.all for parallel operations:

```typescript
const notifications = userIds.map((userId) => sendNotification(userId))
await Promise.all(notifications)
```

### Type Assertions

Use `as` for type assertions, not angle brackets:

```typescript
const file = response.Items[0] as DynamoDBFile  // Good
const file = <DynamoDBFile>response.Items[0]    // Bad
```

## Response Patterns

### Success Responses

```typescript
return response(context, 200, {result: data})
```

### Error Responses

```typescript
return lambdaErrorResponse(context, error)
```

### Direct Error Messages

Only for specific HTTP status codes:

```typescript
return response(context, 404, "User doesn't exist")
return response(context, 503, 'Service temporarily unavailable')
```

## Naming Conventions

### Functions

- Verb + Noun pattern
- Async functions don't need 'Async' suffix

```typescript
async function getUserDevices(userId: string)
async function associateFileToUser(fileId: string, userId: string)
async function getFileByFilename(fileName: string)
```

### Variables

- Descriptive names matching business domain
- Response variables: `<operation>Response`
- Parameter variables: `<operation>Params`

```typescript
const userFileParams = getUserFilesParams(table, userId)
const userFilesResponse = await query(userFileParams)
```

## Prohibited Patterns

### Never Do These

1. **No verbose logging messages**
   ```typescript
   // BAD
   logInfo('Starting stream upload to S3', {bucket, key})
   logInfo('DynamoDB entry created with PendingDownload status')

   // GOOD
   logDebug('streamVideoToS3 <=', {bucket, key})
   logDebug('upsertFile =>')
   ```

2. **No explanatory comments**
   ```typescript
   // BAD
   // Create DynamoDB entry with PendingDownload status
   await upsertFile(item)

   // GOOD
   await upsertFile(item)
   ```

3. **No throwing errors in API Gateway handlers**
   ```typescript
   // BAD
   throw new UnexpectedError('Something failed')

   // GOOD
   return lambdaErrorResponse(context, error)
   ```

4. **No inline return types for handlers**
   ```typescript
   // BAD
   export async function handler(event): Promise<{status: string}>

   // GOOD
   export async function handler(event): Promise<APIGatewayProxyResult>
   export async function handler(event): Promise<void>
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   export async function handler(event): Promise<any>  // For Lambda-to-Lambda
   ```

5. **No AWS SDK imports in Lambda functions**
   ```typescript
   // BAD
   import {S3Client} from '@aws-sdk/client-s3'
   import {LambdaClient} from '@aws-sdk/client-lambda'
   const s3Client = new S3Client({region: 'us-west-2'})

   // GOOD
   import {uploadToS3} from '../../../lib/vendor/AWS/S3'
   await uploadToS3(bucket, key, data)
   ```

6. **No commented out code blocks**
   ```typescript
   // BAD
   // export function oldFunction() {
   //   // Old implementation
   // }

   // GOOD
   // Use version control history for old code
   ```

7. **All interfaces and types in types directory**
   ```typescript
   // BAD - interfaces defined in lib/vendor files
   interface VideoInfo {
     id: string
   }

   // GOOD - interfaces in types/
   import {VideoInfo} from '../../types/youtube'
   ```

## AWS Service Wrappers

All AWS SDK usage must be wrapped in vendor modules:
- `lib/vendor/AWS/DynamoDB.ts` - DynamoDB operations
- `lib/vendor/AWS/S3.ts` - S3 operations
- `lib/vendor/AWS/Lambda.ts` - Lambda invocations
- `lib/vendor/AWS/SNS.ts` - SNS operations
- `lib/vendor/AWS/SQS.ts` - SQS operations
- `lib/vendor/AWS/CloudWatch.ts` - CloudWatch metrics

## Special Cases

### Lambda-to-Lambda Invocation

Return type should be `Promise<any>` and use `response()` helper:

```typescript
export async function handler(event: StartFileUploadParams, context: Context): Promise<any> {
  // ... processing
  return response(context, 200, {status: 'success'})
}
```

### Non-HTTP Event Sources

Return `Promise<void>` for S3, SQS, etc.:

```typescript
export async function handler(event: S3Event): Promise<void> {
  // ... processing
}
```