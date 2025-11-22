# Lambda Function Patterns

## Quick Reference
- **When to use**: Writing AWS Lambda functions
- **Enforcement**: Required - ensures consistent Lambda structure
- **Impact if violated**: Medium - inconsistent codebase, harder maintenance

## The Rule

Lambda functions follow a strict organizational pattern:
1. **Imports** in specific order (AWS Lambda types → Vendor → Types → Utils)
2. **Helper functions** before handler
3. **Handler function** always at bottom of file
4. **All functions async** (unless returning simple values)

## File Structure

### Import Order (STRICT)

```typescript
// 1. AWS Lambda type imports FIRST
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {S3Event, SQSEvent, ScheduledEvent} from 'aws-lambda'

// 2. Vendor library imports (lib/vendor/*)
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'

// 3. Type imports (types/*)
import type {DynamoDBFile, UserProfile} from '../../../types/main'
import type {FileStatus, UserStatus} from '../../../types/enums'

// 4. Utility imports (util/*)
import {logDebug, logInfo, response} from '../../../util/lambda-helpers'
import {UnexpectedError} from '../../../util/errors'
import {validateRequest} from '../../../util/apigateway-helpers'

// 5. NEVER import AWS SDK directly
// Use vendor wrappers instead
```

### Function Organization

```typescript
// 1. Helper functions at top
async function processItem(item: DynamoDBFile) {
  // Implementation
}

async function validateInput(data: unknown) {
  // Implementation
}

// 2. Handler function at bottom
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  // Handler implementation
}
```

## Documentation Standards

### JSDoc Comments

```typescript
/**
 * Associates a File to a User in DynamoDB
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 * @notExported
 */
async function associateFileToUser(fileId: string, userId: string) {
  // Implementation
}
```

**Guidelines**:
- Brief, declarative descriptions (what, not how)
- No implementation details
- Always include `@notExported` tag for internal functions
- Parameter descriptions explain purpose, not type

### Inline Comments

```typescript
// ✅ GOOD - Explains non-obvious business logic
// There will always be 1 result (if the user has a device)
// but with the possibility of multiple devices
const userDevice = userResponse.Items[0] as DynamoDBUserDevice

// ❌ BAD - Explains obvious code
// Increment counter
counter++
```

**Guidelines**:
- AVOID inline comments explaining code
- Only use for non-obvious business logic
- Place above the line, not at end

## Logging Patterns

### Standard Logging Convention

Use arrow notation consistently:

```typescript
// Function input
logDebug('functionName <=', inputParams)

const result = await someFunction(inputParams)

// Function output
logDebug('functionName =>', result)
```

### Log Levels

- **logInfo**: Handler entry and important state changes
- **logDebug**: AWS service calls and internal function boundaries
- **logError**: Error conditions only

### Examples

```typescript
// ✅ CORRECT logging pattern
export async function handler(event: APIGatewayProxyEvent, context: Context) {
  logInfo('Handler started', {requestId: context.requestId})

  logDebug('fetchUserData <=', {userId})
  const userData = await fetchUserData(userId)
  logDebug('fetchUserData =>', userData)

  try {
    logDebug('processUser <=', userData)
    const result = await processUser(userData)
    logDebug('processUser =>', result)

    return response(200, result)
  } catch (error) {
    logError('processUser failed', error)
    throw error
  }
}
```

## Handler Patterns

### API Gateway Handler

```typescript
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {response, lambdaErrorResponse} from '../../../util/lambda-helpers'

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    logInfo('Handler started')

    // Validate input
    const validation = validateRequest(event, constraints)
    if (validation) {
      return lambdaErrorResponse(validation, 400)
    }

    // Business logic
    const result = await processRequest(event)

    return response(200, result)
  } catch (error) {
    logError('Handler error', error)
    return lambdaErrorResponse(error, 500)
  }
}
```

### S3 Event Handler

```typescript
import {S3Event, Context} from 'aws-lambda'

export async function handler(event: S3Event, context: Context): Promise<void> {
  logInfo('S3 Event received', {recordCount: event.Records.length})

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name
    const key = record.s3.object.key

    logDebug('Processing S3 object', {bucket, key})

    await processS3Object(bucket, key)
  }
}
```

### SQS Event Handler

```typescript
import {SQSEvent, Context} from 'aws-lambda'

export async function handler(event: SQSEvent, context: Context): Promise<void> {
  logInfo('SQS Event received', {messageCount: event.Records.length})

  for (const record of event.Records) {
    const message = JSON.parse(record.body)

    logDebug('Processing SQS message', {messageId: record.messageId})

    await processMessage(message)
  }
}
```

### Scheduled Event Handler

```typescript
import {ScheduledEvent, Context} from 'aws-lambda'

export async function handler(event: ScheduledEvent, context: Context): Promise<void> {
  logInfo('Scheduled event triggered', {time: event.time})

  await performScheduledTask()
}
```

## Environment Variables

### Module-Level Constants

Use CamelCase for module-level environment variable constants:

```typescript
// ✅ CORRECT - CamelCase for module-level env vars
const BucketName = process.env.BUCKET_NAME!
const TableName = process.env.TABLE_NAME!
const ApiEndpoint = process.env.API_ENDPOINT!

// ❌ INCORRECT - SCREAMING_SNAKE_CASE deprecated for env vars
const BUCKET_NAME = process.env.BUCKET_NAME!
const TABLE_NAME = process.env.TABLE_NAME!
```

### Access Pattern

```typescript
// At module level (top of file, after imports)
const BucketName = process.env.BUCKET_NAME!
const TableName = process.env.TABLE_NAME!

// Use in functions
async function uploadToS3(data: Buffer) {
  await createS3Upload(BucketName, 'file.txt', data, 'application/octet-stream')
}
```

## Error Handling

### API Gateway Error Responses

```typescript
import {lambdaErrorResponse} from '../../../util/lambda-helpers'
import {UnexpectedError, ValidationError} from '../../../util/errors'

// Validation errors (400)
if (!isValid) {
  return lambdaErrorResponse(new ValidationError('Invalid input'), 400)
}

// Not found (404)
if (!resource) {
  return lambdaErrorResponse(new NotFoundError('Resource not found'), 404)
}

// Server errors (500)
catch (error) {
  logError('Unexpected error', error)
  return lambdaErrorResponse(new UnexpectedError(), 500)
}
```

### Event-Driven Error Handling

```typescript
// For S3, SQS, etc. - throw errors for retry
try {
  await processEvent(event)
} catch (error) {
  logError('Event processing failed', error)
  throw error  // Lambda will retry
}
```

## Response Patterns

### Success Response

```typescript
import {response} from '../../../util/lambda-helpers'

return response(200, {
  message: 'Success',
  data: result
})
```

### Error Response

```typescript
import {lambdaErrorResponse} from '../../../util/lambda-helpers'

return lambdaErrorResponse(error, statusCode)
```

### CORS Headers

```typescript
// Automatically included by response() and lambdaErrorResponse()
return response(200, data)
// Returns:
// {
//   statusCode: 200,
//   headers: {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': '*',
//     'Content-Type': 'application/json'
//   },
//   body: JSON.stringify(data)
// }
```

## AWS Service Usage

### NEVER Import AWS SDK Directly

```typescript
// ❌ FORBIDDEN
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// ✅ REQUIRED - Use vendor wrappers
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
```

See [SDK Encapsulation Policy](../AWS/SDK-Encapsulation-Policy.md) for complete rules.

## Common Patterns

### Database Query

```typescript
import {query} from '../../../lib/vendor/AWS/DynamoDB'

const TableName = process.env.TABLE_NAME!

async function getUserFiles(userId: string) {
  logDebug('query <=', {TableName, userId})

  const result = await query(
    TableName,
    'userId',
    userId
  )

  logDebug('query =>', {itemCount: result.length})

  return result
}
```

### File Upload

```typescript
import {createS3Upload} from '../../../lib/vendor/AWS/S3'

const BucketName = process.env.BUCKET_NAME!

async function uploadFile(key: string, data: Buffer, contentType: string) {
  logDebug('createS3Upload <=', {BucketName, key})

  const upload = createS3Upload(BucketName, key, data, contentType)
  await upload.done()

  logDebug('createS3Upload =>', {key})
}
```

### Lambda Invocation

```typescript
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'

async function triggerDownload(fileId: string) {
  logDebug('invokeLambda <=', {function: 'DownloadHandler', fileId})

  const result = await invokeLambda('DownloadHandler', {fileId})

  logDebug('invokeLambda =>', result)

  return result
}
```

## Testing Considerations

### Handler Exports

```typescript
// Export handler for Lambda runtime
export {handler}

// Export helper functions for testing (if needed)
export {processItem, validateInput}  // Only if tested separately
```

### Testable Structure

```typescript
// ✅ GOOD - Helper functions can be tested independently
async function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0)
}

export async function handler(event, context) {
  const total = await calculateTotal(items)
  return response(200, {total})
}

// Test can import and test calculateTotal separately
```

## Common Mistakes

### Mistake 1: Imports Out of Order

```typescript
// ❌ WRONG
import {logDebug} from '../../../util/lambda-helpers'
import {APIGatewayProxyEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'

// ✅ CORRECT - AWS Lambda types first
import {APIGatewayProxyEvent} from 'aws-lambda'
import {query} from '../../../lib/vendor/AWS/DynamoDB'
import {logDebug} from '../../../util/lambda-helpers'
```

### Mistake 2: Handler Not at Bottom

```typescript
// ❌ WRONG
export async function handler(event, context) {
  // Handler code
}

async function helperFunction() {
  // Helper code
}

// ✅ CORRECT - Helpers before handler
async function helperFunction() {
  // Helper code
}

export async function handler(event, context) {
  // Handler code
}
```

### Mistake 3: Direct AWS SDK Usage

```typescript
// ❌ WRONG
import {S3Client} from '@aws-sdk/client-s3'

// ✅ CORRECT
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
```

## Related Patterns

- [Import Organization](../Conventions/Import-Organization.md) - Import order rules
- [AWS SDK Encapsulation](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper usage
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Function and variable naming
- [Error Handling](Error-Handling.md) - Error patterns for different event types

---

*Follow these patterns for consistent, maintainable Lambda functions. Structure matters for readability and testability.*