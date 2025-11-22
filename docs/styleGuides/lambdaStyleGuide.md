# Lambda Function Style Guide

This document provides quick reference for AWS Lambda function development in this project. For complete patterns and detailed explanations, see the wiki.

## Wiki Standards Applied

This project follows these wiki conventions for Lambda functions:

- **[AWS SDK Encapsulation Policy](../wiki/AWS/SDK-Encapsulation-Policy.md)** - ZERO-TOLERANCE: Never import AWS SDK directly
- **[Lambda Function Patterns](../wiki/TypeScript/Lambda-Function-Patterns.md)** - File structure, handler organization
- **[Import Organization](../wiki/Conventions/Import-Organization.md)** - Strict import ordering
- **[Naming Conventions](../wiki/Conventions/Naming-Conventions.md)** - camelCase for variables/functions

## Quick Reference

### ⚠️ CRITICAL: AWS SDK Encapsulation

```typescript
// ❌ FORBIDDEN
import {S3Client} from '@aws-sdk/client-s3'

// ✅ REQUIRED
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
```

See [SDK Encapsulation Policy](../wiki/AWS/SDK-Encapsulation-Policy.md) for complete rules.

### Import Order

```typescript
// 1. AWS Lambda types
import {APIGatewayProxyResult, Context} from 'aws-lambda'

// 2. Vendor wrappers
import {query} from '../../../lib/vendor/AWS/DynamoDB'

// 3. Type imports
import type {DynamoDBFile} from '../../../types/main'

// 4. Utility imports
import {logDebug, response} from '../../../util/lambda-helpers'
```

See [Import Organization](../wiki/Conventions/Import-Organization.md) for details.

### Function Organization

```typescript
// 1. Helper functions first
async function processItem(item: Item) {
  // Implementation
}

// 2. Handler function last
export async function handler(event, context) {
  // Handler implementation
}
```

See [Lambda Function Patterns](../wiki/TypeScript/Lambda-Function-Patterns.md) for patterns.

### Environment Variables

```typescript
// ✅ CORRECT - CamelCase for module-level constants
const BucketName = process.env.BUCKET_NAME!
const TableName = process.env.TABLE_NAME!

// ❌ INCORRECT - SCREAMING_SNAKE_CASE deprecated
const BUCKET_NAME = process.env.BUCKET_NAME!
```

### Logging Convention

```typescript
logDebug('functionName <=', inputParams)
const result = await someFunction(inputParams)
logDebug('functionName =>', result)
```

## Project-Specific Examples

### Typical Lambda Handler

```typescript
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {query, updateItem} from '../../../lib/vendor/AWS/DynamoDB'
import type {DynamoDBFile} from '../../../types/main'
import {logDebug, logInfo, response, lambdaErrorResponse} from '../../../util/lambda-helpers'
import {validateRequest} from '../../../util/apigateway-helpers'

const TableName = process.env.TABLE_NAME!

async function getUserFiles(userId: string): Promise<DynamoDBFile[]> {
  logDebug('query <=', {TableName, userId})
  const result = await query(TableName, 'userId', userId)
  logDebug('query =>', {itemCount: result.length})
  return result as DynamoDBFile[]
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  logInfo('Handler started', {requestId: context.requestId})

  try {
    const userId = event.requestContext.authorizer?.userId

    const validation = validateRequest(event, constraints)
    if (validation) {
      return lambdaErrorResponse(validation, 400)
    }

    const files = await getUserFiles(userId)
    return response(200, {files})

  } catch (error) {
    logError('Handler error', error)
    return lambdaErrorResponse(error, 500)
  }
}
```

### Common Patterns in This Project

#### Database Query
```typescript
const result = await query(TableName, 'userId', userId)
```

#### File Upload
```typescript
const upload = createS3Upload(BucketName, key, data, 'video/mp4')
await upload.done()
```

#### Lambda Invocation
```typescript
await invokeLambda('DownloadHandler', {fileId})
```

#### Metrics
```typescript
await putMetric('DownloadCount', 1, 'Count')
```

## Pre-Commit Checklist

Before committing Lambda code:

- [ ] No `@aws-sdk/*` imports outside `lib/vendor/AWS/`
- [ ] Imports follow strict order
- [ ] Handler function is at bottom
- [ ] Environment variables use CamelCase
- [ ] Logging uses arrow notation (<= / =>)
- [ ] All vendor wrappers exist

## Common Mistakes

### Mistake 1: Direct AWS SDK Import
```typescript
// ❌ WRONG
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// ✅ CORRECT
import {query} from '../../../lib/vendor/AWS/DynamoDB'
```

### Mistake 2: Imports Out of Order
```typescript
// ❌ WRONG - util before types
import {logDebug} from '../../../util/lambda-helpers'
import type {DynamoDBFile} from '../../../types/main'

// ✅ CORRECT - types before utils
import type {DynamoDBFile} from '../../../types/main'
import {logDebug} from '../../../util/lambda-helpers'
```

### Mistake 3: Handler Not at Bottom
```typescript
// ❌ WRONG
export async function handler(event, context) { }
async function helperFunction() { }

// ✅ CORRECT
async function helperFunction() { }
export async function handler(event, context) { }
```

## Related Documentation

- [Lambda Function Patterns](../wiki/TypeScript/Lambda-Function-Patterns.md) - Complete patterns
- [AWS SDK Encapsulation Policy](../wiki/AWS/SDK-Encapsulation-Policy.md) - ZERO-TOLERANCE rule
- [Import Organization](../wiki/Conventions/Import-Organization.md) - Import order details
- [Naming Conventions](../wiki/Conventions/Naming-Conventions.md) - camelCase vs PascalCase

---

*This style guide is a quick reference. For complete patterns, explanations, and rationale, see the linked wiki pages above.*