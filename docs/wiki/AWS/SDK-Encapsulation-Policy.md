# AWS SDK Encapsulation Policy

## Quick Reference
- **When to use**: Every AWS service interaction in the codebase
- **Enforcement**: ZERO-TOLERANCE - No exceptions allowed
- **Impact if violated**: CRITICAL - Breaks architectural pattern, fails code review

## The Rule

**NEVER import AWS SDK packages directly in application code.**

ALL AWS SDK usage MUST be wrapped in vendor modules located in `lib/vendor/AWS/`.

## Examples

### ❌ FORBIDDEN - Direct AWS SDK Usage

```typescript
// ❌ NEVER DO THIS - Direct AWS SDK imports
import {S3Client, PutObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {StandardUnit} from '@aws-sdk/client-cloudwatch'
import {SNSClient, PublishCommand} from '@aws-sdk/client-sns'
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs'

// ❌ NEVER DO THIS - Creating AWS clients in application code
const s3Client = new S3Client({region: 'us-west-2'})
const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: 'my-bucket',
    Key: 'file.txt',
    Body: stream
  }
})

// ❌ NEVER DO THIS - Using AWS SDK types in function signatures
import {PutObjectCommandInput} from '@aws-sdk/client-s3'

function uploadFile(params: PutObjectCommandInput) {
  // Implementation
}
```

### ✅ REQUIRED - Vendor Wrapper Usage

```typescript
// ✅ ALWAYS DO THIS - Use vendor wrappers
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'
import {updateItem, query} from '../../../lib/vendor/AWS/DynamoDB'
import {putMetric, putMetrics} from '../../../util/lambda-helpers'
import {publish} from '../../../lib/vendor/AWS/SNS'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'

// ✅ Use wrapper functions - simple types only
const upload = createS3Upload('my-bucket', 'file.txt', stream, 'text/plain')

await putMetric('DownloadCount', 1, 'Count')

const result = await query('TableName', 'userId', 'user-123')

await invokeLambda('FunctionName', {payload: data})
```

## Why This Rule Exists

### 1. Encapsulation
AWS SDK types and clients are implementation details that should be hidden from business logic. Application code should work with domain concepts, not AWS-specific constructs.

### 2. Type Safety
Public APIs use simple TypeScript types (string, number, boolean) instead of AWS SDK enums and complex types. This prevents AWS implementation details from leaking throughout the codebase.

```typescript
// ❌ AWS SDK type leaking
function putMetric(name: string, value: number, unit: StandardUnit) {}

// ✅ Simple type
function putMetric(name: string, value: number, unit: string) {}
```

### 3. Testability
Mocking vendor wrappers is much cleaner than mocking AWS SDK clients and commands.

```typescript
// ✅ Easy to mock
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn().mockResolvedValue({done: jest.fn()}),
  headObject: jest.fn().mockResolvedValue({ContentLength: 1024})
}))

// ❌ Complex AWS SDK mocking
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn()
}))
```

### 4. Maintainability
AWS SDK version changes are isolated to vendor wrapper files. When AWS updates their SDK, you only update wrapper implementations, not hundreds of files.

### 5. Consistency
One pattern for all AWS service usage across the entire codebase. Every developer knows exactly where to look and how to use AWS services.

## Where AWS SDK Imports Are Allowed

**ONLY** in these files:
- `lib/vendor/AWS/S3.ts`
- `lib/vendor/AWS/Lambda.ts`
- `lib/vendor/AWS/DynamoDB.ts`
- `lib/vendor/AWS/CloudWatch.ts`
- `lib/vendor/AWS/SNS.ts`
- `lib/vendor/AWS/SQS.ts`

**NOWHERE else.**

## Enforcement Checklist

### Before Writing ANY Code

**MANDATORY CHECKS**:

1. ✅ Does the vendor wrapper for this AWS service exist?
   - **YES** → Use the wrapper functions
   - **NO** → CREATE the wrapper FIRST, then use it

2. ✅ Am I importing from `@aws-sdk/*`?
   - **YES** → STOP. You're violating the policy. Use the wrapper instead.
   - **NO** → Proceed

3. ✅ Am I exposing AWS SDK types in function signatures?
   - **YES** → STOP. Change to simple types (string, number, boolean)
   - **NO** → Proceed

### Before Committing

Run this check:
```bash
# This should ONLY show files in lib/vendor/AWS/
grep -r "from '@aws-sdk/" src/ lib/ util/ --include="*.ts" | grep -v "lib/vendor/AWS"

# If this returns ANY results, you've violated the policy
```

### During Code Review

- [ ] No `@aws-sdk/*` imports outside `lib/vendor/AWS/`
- [ ] No AWS SDK types in public function signatures
- [ ] No AWS SDK clients created in application code
- [ ] Vendor wrappers exist for all AWS services used
- [ ] Wrapper functions use simple types only

## Creating New Vendor Wrappers

When you need an AWS service that doesn't have a wrapper:

### Step 1: Create Wrapper File

```typescript
// lib/vendor/AWS/NewService.ts
import {NewServiceClient, SomeCommand} from '@aws-sdk/client-newservice'

const client = new NewServiceClient({
  region: process.env.AWS_REGION || 'us-west-2'
})

/**
 * Description of what this does
 * @param param1 - Simple type parameter
 * @param param2 - Another simple type
 * @returns Simple return type
 */
export async function doSomething(param1: string, param2: number): Promise<string> {
  const command = new SomeCommand({
    Param1: param1,
    Param2: param2
  })

  const response = await client.send(command)
  return response.Result
}
```

### Step 2: Export from Vendor Index

```typescript
// lib/vendor/AWS/index.ts
export * from './S3'
export * from './Lambda'
export * from './NewService'  // Add new export
```

### Step 3: Use in Application Code

```typescript
// src/lambdas/MyLambda/src/index.ts
import {doSomething} from '../../../lib/vendor/AWS/NewService'

const result = await doSomething('value', 123)
```

## Vendor Wrapper Patterns

### Simple Function Wrapper

```typescript
// lib/vendor/AWS/S3.ts
export async function headObject(bucket: string, key: string) {
  const command = new HeadObjectCommand({Bucket: bucket, Key: key})
  return await s3Client.send(command)
}
```

### Complex Operation Wrapper

```typescript
// lib/vendor/AWS/S3.ts
export function createS3Upload(
  bucket: string,
  key: string,
  body: any,
  contentType: string
) {
  return new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }
  })
}
```

### Type Conversion Wrapper

```typescript
// lib/vendor/AWS/CloudWatch.ts
export function getStandardUnit(unit?: string): string {
  // Convert simple string to AWS SDK enum internally
  const validUnits = ['Count', 'Bytes', 'Seconds', ...]
  return validUnits.includes(unit || '') ? unit! : 'None'
}
```

## Common Violations and Fixes

### Violation 1: Direct Import

```typescript
// ❌ WRONG
import {S3Client} from '@aws-sdk/client-s3'

// ✅ CORRECT
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
```

### Violation 2: Creating Clients

```typescript
// ❌ WRONG
const dynamoDb = new DynamoDBClient({region: 'us-west-2'})

// ✅ CORRECT - Client created in vendor wrapper
import {query} from '../../../lib/vendor/AWS/DynamoDB'
```

### Violation 3: AWS SDK Types in Signatures

```typescript
// ❌ WRONG
import {StandardUnit} from '@aws-sdk/client-cloudwatch'
function metric(unit: StandardUnit) {}

// ✅ CORRECT
function metric(unit: string) {}
```

### Violation 4: Direct Command Usage

```typescript
// ❌ WRONG
import {PutObjectCommand} from '@aws-sdk/client-s3'
const command = new PutObjectCommand({...})

// ✅ CORRECT
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
const upload = createS3Upload(bucket, key, body, contentType)
```

## Testing with Vendor Wrappers

### Mock the Wrapper, Not AWS SDK

```typescript
// ✅ CORRECT - Mock vendor wrapper
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: jest.fn<() => Promise<{done: () => Promise<void>}>>()
    .mockResolvedValue({
      done: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    }),
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024})
}))

// ❌ WRONG - Mocking AWS SDK directly
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({send: jest.fn()}))
}))
```

## Benefits Realized

1. **Single Point of Change** - Update AWS SDK usage in one place
2. **Consistent Error Handling** - Centralized retry and error logic
3. **Easy Testing** - Simple function mocks vs complex SDK mocks
4. **Type Safety** - No AWS enums leaking into business logic
5. **Documentation** - Wrappers document AWS service usage
6. **Versioning** - SDK updates don't break application code

## Migration Guide

If you find code violating this policy:

### Step 1: Identify Violations

```bash
grep -r "from '@aws-sdk/" src/ --include="*.ts"
```

### Step 2: Check if Wrapper Exists

Look in `lib/vendor/AWS/` for the service wrapper.

### Step 3: Create Wrapper if Needed

Follow the wrapper creation pattern above.

### Step 4: Replace Direct Usage

```typescript
// Before
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
const client = new S3Client({region: 'us-west-2'})
await client.send(new PutObjectCommand({...}))

// After
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
const upload = createS3Upload(bucket, key, body, contentType)
await upload.done()
```

### Step 5: Update Tests

```typescript
// Before - Mocking AWS SDK
jest.mock('@aws-sdk/client-s3')

// After - Mocking vendor wrapper
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({...}))
```

## Exceptions

**There are NO exceptions to this rule.**

If you think you need an exception:
1. You don't
2. Create a vendor wrapper instead
3. Talk to the team if truly stuck

## Related Patterns

- [Import Organization](../Conventions/Import-Organization.md) - Never import from @aws-sdk/*
- [Testing Patterns](../Testing/Jest-ESM-Mocking-Strategy.md) - Mock vendor wrappers
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Use wrappers in handlers

---

*This policy is ZERO-TOLERANCE. No AWS SDK imports outside lib/vendor/AWS/. Period. If you violate this rule, your code WILL be rejected in review.*