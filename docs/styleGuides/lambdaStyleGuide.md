# Lambda Function Style Guide

This document defines the coding standards and patterns for AWS Lambda functions in this project.

---

## ⚠️ CRITICAL RULE: AWS SDK ENCAPSULATION ⚠️

**NEVER import AWS SDK packages directly in application code.**

### ❌ FORBIDDEN - Direct AWS SDK Usage
```typescript
// NEVER DO THIS - Direct AWS SDK imports
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {Upload} from '@aws-sdk/lib-storage'
import {StandardUnit} from '@aws-sdk/client-cloudwatch'

// NEVER DO THIS - Creating AWS clients in application code
const s3Client = new S3Client({region: 'us-west-2'})
const upload = new Upload({client: s3Client, params: {...}})
```

### ✅ REQUIRED - Vendor Wrapper Usage
```typescript
// ALWAYS DO THIS - Use vendor wrappers
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'
import {updateItem, query} from '../../../lib/vendor/AWS/DynamoDB'
import {putMetric} from '../../../util/lambda-helpers'

// Use wrapper functions - NO AWS SDK types exposed
const upload = createS3Upload(bucket, key, stream, 'video/mp4')
await putMetric('MetricName', 1, 'Count')
```

### Why This Rule Exists

1. **Encapsulation**: AWS SDK implementation details hidden from business logic
2. **Type Safety**: Public APIs use simple types (strings, numbers) instead of AWS SDK enums
3. **Testability**: Mocking vendor wrappers is cleaner than mocking AWS SDK
4. **Maintainability**: AWS SDK changes isolated to vendor wrapper files
5. **Consistency**: One pattern for all AWS service usage

### Enforcement Checklist

Before committing ANY code:
- [ ] Search codebase for `from '@aws-sdk/` - should ONLY appear in `lib/vendor/AWS/*` files
- [ ] Check imports - NO AWS SDK packages in Lambda handlers or util files
- [ ] Verify vendor wrappers exist for all AWS services you need
- [ ] If wrapper doesn't exist, CREATE it in `lib/vendor/AWS/` before using the service

---

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

### Fixture Logging for Production Data Extraction

Use fixture logging functions to mark events, responses, and AWS service calls for automatic extraction from CloudWatch Logs:

```typescript
export async function handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
  // Log incoming event for fixture extraction
  logIncomingFixture(event)
  
  try {
    // Business logic...
    const result = await doSomething()
    
    // Log outgoing response for fixture extraction
    const response = response(context, 200, result)
    logOutgoingFixture(response)
    return response
  } catch (error) {
    const errorResponse = lambdaErrorResponse(context, error)
    logOutgoingFixture(errorResponse)
    return errorResponse
  }
}
```

**When to use fixture logging:**
- `logIncomingFixture()`: Log Lambda handler entry (replaces `logInfo('event <=', event)`)
- `logOutgoingFixture()`: Log Lambda handler response before returning
- `logInternalFixture()`: Log AWS service responses (optional, for complex workflows)

**Benefits:**
- Fixtures automatically extracted from production CloudWatch Logs
- Always matches actual production payloads
- Eliminates manual fixture maintenance
- Single-parameter API (auto-detects Lambda name)

**Note:** Fixture logging replaces the traditional `logInfo('event <=', event)` pattern at handler entry. For internal debugging, continue using `logDebug()` with arrow notation.

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

**Module-level constants from environment variables:**

When declaring module-level constants from environment variables, use CamelCase:

```typescript
// GOOD - CamelCase constant name, direct reference to typed env var
const ytdlpBinaryPath = process.env.YtdlpBinaryPath as string

// BAD - SCREAMING_SNAKE_CASE for module constant
const YTDLP_BINARY_PATH = process.env.YTDLP_BINARY_PATH || '/opt/bin/yt-dlp_linux'
```

**Important:**
- All environment variables must be declared in `types/global.d.ts`
- Use direct reference with `as string` (no fallback values)
- Module-level constants follow CamelCase naming
- No need to exclude from OpenTofu infrastructure tests

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

   // GOOD - Use standard AWS Lambda return types
   export async function handler(event): Promise<APIGatewayProxyResult>
   export async function handler(event): Promise<void>

   // GOOD - Omit return type and let TypeScript infer (avoids Promise<any> and eslint exceptions)
   export async function handler(event, context) {
     // TypeScript infers return type from implementation
     return response(context, 200, {status: 'success'})
   }
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

8. **No comments explaining removed code or deprecated features**
   ```typescript
   // BAD - explaining what was removed
   // Multipart upload removed - now using direct streaming
   // Previous implementation used Step Functions
   // Old architecture: start -> upload -> complete

   // BAD - TODO comments about deprecated code
   // TODO: These imports are deprecated after migration
   // import {oldLibrary} from 'old-package'

   // GOOD - just delete the comments, use git history
   // (no comments needed - git log shows what changed)
   ```

   **Why**: Git is the source of truth for historical code. Use `git log`, `git blame`, and `git diff` to understand what was removed and why.

## AWS Service Wrappers

All AWS SDK usage must be wrapped in vendor modules:
- `lib/vendor/AWS/DynamoDB.ts` - DynamoDB operations
- `lib/vendor/AWS/Lambda.ts` - Lambda invocations
- `lib/vendor/AWS/SNS.ts` - SNS operations
- `lib/vendor/AWS/SQS.ts` - SQS operations
- `lib/vendor/AWS/CloudWatch.ts` - CloudWatch metrics

## Special Cases

### Lambda-to-Lambda Invocation

Omit return type annotation and let TypeScript infer:

```typescript
// GOOD - TypeScript infers return type from response() helper
export async function handler(event: StartFileUploadParams, context: Context) {
  // ... processing
  return response(context, 200, {status: 'success'})
}
```

**Why omit the return type?**
- Avoids `Promise<any>` which provides no type safety
- Eliminates need for `eslint-disable-next-line @typescript-eslint/no-explicit-any`
- TypeScript correctly infers the return type from implementation
- Cleaner code without eslint exceptions

### Non-HTTP Event Sources

Explicitly use `Promise<void>` for S3, SQS, etc.:

```typescript
export async function handler(event: S3Event): Promise<void> {
  // ... processing
}
```