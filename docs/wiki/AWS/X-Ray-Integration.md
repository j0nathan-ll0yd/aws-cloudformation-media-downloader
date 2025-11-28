# X-Ray Integration

## Quick Reference
- **When to use**: All Lambda functions for distributed tracing
- **Enforcement**: Recommended
- **Impact if violated**: LOW - Reduced visibility

## X-Ray Decorator Pattern

```typescript
// lib/vendor/AWS/XRay.ts
import AWSXRay from 'aws-xray-sdk-core'

export function withXRay<TEvent = any, TResult = any>(
  handler: (event: TEvent, context: Context, metadata: {traceId: string}) => Promise<TResult>
) {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    const segment = AWSXRay.getSegment()
    const traceId = (segment as any)?.trace_id || context.awsRequestId
    return handler(event, context, {traceId})
  }
}

export function captureAWSClient<T>(client: T): T {
  if (process.env.ENABLE_XRAY === 'false' || process.env.USE_LOCALSTACK === 'true') {
    return client
  }
  return AWSXRay.captureAWSv3Client(client)
}
```

## Lambda Usage

```typescript
// All Lambda handlers use withXRay
export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('event <=', event)
  // traceId available for correlation
  return response(context, 200, data)
})
```

## AWS SDK Integration

```typescript
// lib/vendor/AWS/S3.ts
import {S3Client} from '@aws-sdk/client-s3'
import {captureAWSClient} from './XRay'

const s3Client = captureAWSClient(new S3Client())
```

## Custom Subsegments

```typescript
import {captureAsyncFunc} from '../AWS/XRay'

export async function downloadVideo(url: string) {
  return captureAsyncFunc('downloadVideo', async (subsegment) => {
    subsegment?.addAnnotation('url', url)
    subsegment?.addMetadata('size', result.size)
    // Perform operation
    return result
  })
}
```

## Annotations vs Metadata

- **Annotations** - Indexed, searchable (userId, operation)
- **Metadata** - Detailed info, not searchable (request body, response)

## OpenTofu Configuration

```hcl
resource "aws_lambda_function" "process_file" {
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      EnableXRay = "true"
    }
  }
}

resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
```

## Testing

```typescript
// Disable X-Ray in tests
beforeEach(() => {
  process.env.EnableXRay = 'false'
})

// Mock X-Ray
jest.unstable_mockModule('../../../lib/vendor/AWS/XRay', () => ({
  withXRay: (handler: any) => handler,
  captureAWSClient: (client: any) => client,
  captureAsyncFunc: async (name: string, fn: any) => fn()
}))
```

## Best Practices

✅ Use withXRay decorator for all Lambdas
✅ Wrap AWS SDK clients with captureAWSClient
✅ Create subsegments for slow operations
✅ Include trace ID in logs
✅ Use annotations for searchable fields
✅ Disable X-Ray in tests

## Related Patterns

- [CloudWatch Logging](CloudWatch-Logging.md)
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)

---

*Use X-Ray for distributed tracing. The withXRay decorator provides automatic instrumentation.*