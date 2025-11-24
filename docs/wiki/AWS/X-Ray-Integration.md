# X-Ray Integration

## Quick Reference
- **When to use**: All Lambda functions for distributed tracing
- **Enforcement**: Recommended - aids debugging and performance analysis
- **Impact if violated**: LOW - Reduced visibility into request flows

## Overview

AWS X-Ray provides distributed tracing to track requests through the system. Use the X-Ray decorator pattern to automatically instrument Lambda functions and custom subsegments for detailed operation tracking.

## The Rules

### 1. Use X-Ray Decorator for All Lambdas

Wrap all Lambda handlers with `withXRay` decorator.

### 2. Create Subsegments for External Calls

Track AWS service calls, HTTP requests, and database operations.

### 3. Include Trace ID in Logs

Add trace ID to structured logs for correlation.

### 4. Capture Errors and Exceptions

Ensure X-Ray captures error information.

## X-Ray Decorator Pattern

### Implementation

```typescript
// lib/vendor/AWS/XRay.ts

import * as AWSXRay from 'aws-xray-sdk-core'
import {Context} from 'aws-lambda'

export interface XRayContext {
  traceId: string
  segment?: any
}

/**
 * X-Ray decorator for Lambda functions
 * Automatically captures Lambda execution and errors
 */
export function withXRay<TEvent, TResult>(
  handler: (event: TEvent, context: Context, xray: XRayContext) => Promise<TResult>
) {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    // X-Ray disabled in test environments
    if (process.env.ENABLE_XRAY !== 'true' || process.env.NODE_ENV === 'test') {
      return handler(event, context, {traceId: 'test-trace-id'})
    }
    
    const segment = AWSXRay.getSegment()
    const traceId = segment?.trace_id || process.env._X_AMZN_TRACE_ID || 'unknown'
    
    try {
      // Add metadata to segment
      segment?.addAnnotation('functionName', context.functionName)
      segment?.addAnnotation('functionVersion', context.functionVersion)
      
      const result = await handler(event, context, {traceId, segment})
      
      // Mark success
      segment?.addMetadata('result', {
        statusCode: (result as any).statusCode || 200
      })
      
      return result
    } catch (error) {
      // Capture error
      segment?.addError(error as Error)
      segment?.addAnnotation('error', (error as Error).message)
      
      throw error
    }
  }
}

/**
 * Capture AWS SDK clients for X-Ray tracing
 */
export function captureAWSClient<T>(client: T): T {
  if (process.env.ENABLE_XRAY === 'true' && process.env.NODE_ENV !== 'test') {
    return AWSXRay.captureAWSv3Client(client as any) as T
  }
  return client
}

/**
 * Create custom subsegment for tracking operations
 */
export async function captureAsyncFunc<T>(
  name: string,
  fn: (subsegment?: any) => Promise<T>
): Promise<T> {
  if (process.env.ENABLE_XRAY !== 'true' || process.env.NODE_ENV === 'test') {
    return fn()
  }
  
  return new Promise((resolve, reject) => {
    AWSXRay.captureAsyncFunc(name, async (subsegment) => {
      try {
        const result = await fn(subsegment)
        subsegment?.close()
        resolve(result)
      } catch (error) {
        subsegment?.addError(error as Error)
        subsegment?.close()
        reject(error)
      }
    })
  })
}
```

## Examples

### ✅ Correct - Lambda with X-Ray

```typescript
// src/lambdas/ProcessFile/src/index.ts

import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {logInfo, logError} from '../../../util/lambda-helpers'
import {createS3Upload} from '../../../lib/vendor/AWS/S3'

export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('Processing file', {
    context: 'handler',
    traceId,  // Include trace ID in logs
    fileId: event.fileId
  })
  
  try {
    // Business logic
    const result = await processFile(event.fileId, traceId)
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  } catch (error) {
    logError(error, {
      context: 'handler',
      traceId,
      fileId: event.fileId
    })
    
    return {
      statusCode: 500,
      body: JSON.stringify({error: 'Processing failed'})
    }
  }
})
```

### ✅ Correct - AWS SDK with X-Ray

```typescript
// lib/vendor/AWS/S3.ts

import {S3Client, HeadObjectCommand} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import {captureAWSClient} from './XRay'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-west-2'
    })
    
    // ✅ Wrap client with X-Ray
    s3Client = captureAWSClient(client)
  }
  return s3Client
}

export async function headObject(bucket: string, key: string) {
  const client = getS3Client()
  const command = new HeadObjectCommand({Bucket: bucket, Key: key})
  
  // Automatically traced by X-Ray
  return await client.send(command)
}

export function createS3Upload(
  bucket: string,
  key: string,
  body: any,
  contentType: string
) {
  const client = getS3Client()
  
  return new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }
  })
}
```

### ✅ Correct - Custom Subsegments

```typescript
// src/services/video-service.ts

import {captureAsyncFunc} from '../../lib/vendor/AWS/XRay'
import {logInfo} from '../../util/lambda-helpers'

export async function downloadVideo(url: string, traceId: string) {
  // Create subsegment for video download
  return captureAsyncFunc('downloadVideo', async (subsegment) => {
    subsegment?.addAnnotation('url', url)
    subsegment?.addAnnotation('operation', 'download')
    
    logInfo('Starting video download', {
      context: 'video-service',
      traceId,
      url
    })
    
    try {
      const startTime = Date.now()
      
      // Download logic
      const result = await performDownload(url)
      
      const duration = Date.now() - startTime
      subsegment?.addMetadata('duration', duration)
      subsegment?.addMetadata('size', result.size)
      
      logInfo('Video download completed', {
        context: 'video-service',
        traceId,
        url,
        duration,
        size: result.size
      })
      
      return result
    } catch (error) {
      subsegment?.addError(error as Error)
      throw error
    }
  })
}
```

### ✅ Correct - External HTTP Calls

```typescript
// lib/vendor/External/GitHub.ts

import {captureAsyncFunc} from '../AWS/XRay'

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string
): Promise<number> {
  return captureAsyncFunc('github.createIssue', async (subsegment) => {
    subsegment?.addAnnotation('owner', owner)
    subsegment?.addAnnotation('repo', repo)
    
    const octokit = getOctokit()
    
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body
    })
    
    subsegment?.addMetadata('issueNumber', response.data.number)
    
    return response.data.number
  })
}
```

### ❌ Incorrect - No X-Ray Decorator

```typescript
// ❌ WRONG - Handler without X-Ray
export const handler = async (event, context) => {
  // No tracing, no error capture
  const result = await processFile(event.fileId)
  return {statusCode: 200, body: result}
}

// ✅ CORRECT - Use decorator
export const handler = withXRay(async (event, context, {traceId}) => {
  const result = await processFile(event.fileId, traceId)
  return {statusCode: 200, body: result}
})
```

### ❌ Incorrect - AWS Client Without X-Ray

```typescript
// ❌ WRONG - Client not wrapped
const s3Client = new S3Client({region: 'us-west-2'})

// ✅ CORRECT - Wrap with X-Ray
const client = new S3Client({region: 'us-west-2'})
const s3Client = captureAWSClient(client)
```

## X-Ray Annotations vs Metadata

### Annotations (Indexed, Searchable)

Use for values you want to filter/search by:

```typescript
subsegment?.addAnnotation('userId', userId)
subsegment?.addAnnotation('operation', 'download')
subsegment?.addAnnotation('status', 'success')

// Can search in X-Ray console:
// annotation.userId = "user-123"
// annotation.operation = "download"
```

### Metadata (Not Indexed, Detailed Info)

Use for detailed information:

```typescript
subsegment?.addMetadata('request', {
  url: event.url,
  method: event.method,
  headers: event.headers
})

subsegment?.addMetadata('response', {
  statusCode: response.status,
  size: response.data.length
})

// Visible in trace details but not searchable
```

## OpenTofu Configuration

### Enable X-Ray for Lambda

```hcl
# terraform/LambdaProcessFile.tf

resource "aws_lambda_function" "process_file" {
  function_name = "ProcessFile"
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  
  # Enable active tracing
  tracing_config {
    mode = "Active"
  }
  
  environment {
    variables = {
      ENABLE_XRAY = "true"
    }
  }
}

# Grant X-Ray permissions
resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
```

### API Gateway X-Ray

```hcl
# terraform/ApiGateway.tf

resource "aws_api_gateway_stage" "api" {
  deployment_id = aws_api_gateway_deployment.api.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
  
  # Enable X-Ray tracing
  xray_tracing_enabled = true
}
```

## X-Ray Service Map

X-Ray automatically generates service maps showing:
- Lambda functions
- API Gateway endpoints
- AWS services (S3, DynamoDB, SNS)
- External HTTP calls
- Request/response times
- Error rates

View in AWS Console: CloudWatch → X-Ray → Service Map

## Performance Analysis

### Identifying Bottlenecks

```typescript
// Add timing metadata for analysis
export async function complexOperation(traceId: string) {
  return captureAsyncFunc('complexOperation', async (subsegment) => {
    const step1Start = Date.now()
    await step1()
    subsegment?.addMetadata('step1Duration', Date.now() - step1Start)
    
    const step2Start = Date.now()
    await step2()
    subsegment?.addMetadata('step2Duration', Date.now() - step2Start)
    
    const step3Start = Date.now()
    await step3()
    subsegment?.addMetadata('step3Duration', Date.now() - step3Start)
    
    // X-Ray shows which step is slow
  })
}
```

## Testing with X-Ray

### Disable in Tests

```typescript
// test/lambdas/ProcessFile/index.test.ts

describe('ProcessFile handler', () => {
  beforeEach(() => {
    // Disable X-Ray for tests
    process.env.ENABLE_XRAY = 'false'
    process.env.NODE_ENV = 'test'
  })
  
  it('processes file', async () => {
    const {handler} = await import('../src/index')
    
    const result = await handler(event, context)
    
    expect(result.statusCode).toBe(200)
  })
})
```

### Mock X-Ray Context

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/XRay', () => ({
  withXRay: (handler: any) => handler,  // Pass through
  captureAWSClient: (client: any) => client,  // Pass through
  captureAsyncFunc: async (name: string, fn: any) => fn()  // Pass through
}))
```

## Rationale

### X-Ray Benefits

1. **Distributed Tracing** - Track requests across services
2. **Performance Analysis** - Identify slow operations
3. **Error Tracking** - Capture and visualize errors
4. **Service Dependencies** - Understand system architecture
5. **Debugging** - Correlate logs with traces

### Cost Considerations

1. **First 100K traces/month**: Free
2. **Additional traces**: $5 per million
3. **Trace storage**: First 30 days free
4. **Typically low cost** for most applications

## Enforcement

### Code Review Checklist

- [ ] All Lambda handlers use `withXRay` decorator
- [ ] AWS SDK clients wrapped with `captureAWSClient`
- [ ] Custom subsegments for expensive operations
- [ ] Trace ID included in logs
- [ ] Annotations used for searchable values
- [ ] Metadata used for detailed info
- [ ] X-Ray disabled in tests

### Verification

```bash
# Check for unwrapped handlers
grep -rn "export const handler = async" src/lambdas/ | grep -v "withXRay"

# Check for unwrapped AWS clients
grep -rn "new.*Client(" lib/vendor/AWS/ | grep -v "captureAWSClient"
```

## Best Practices

### Do's

✅ Use `withXRay` decorator for all Lambdas
✅ Wrap AWS SDK clients with `captureAWSClient`
✅ Create subsegments for slow operations
✅ Include trace ID in structured logs
✅ Use annotations for searchable fields
✅ Use metadata for detailed information
✅ Disable X-Ray in test environments

### Don'ts

❌ Don't wrap clients multiple times
❌ Don't create excessive subsegments (performance impact)
❌ Don't put large objects in annotations
❌ Don't forget to close subsegments
❌ Don't enable X-Ray in unit tests
❌ Don't assume trace ID always exists

## Related Patterns

- [CloudWatch Logging](CloudWatch-Logging.md) - Include trace ID in logs
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler structure
- [Error Handling](../TypeScript/Error-Handling.md) - Error capture in X-Ray

---

*Use X-Ray for distributed tracing across Lambda functions and AWS services. The decorator pattern provides automatic instrumentation with minimal code changes.*
