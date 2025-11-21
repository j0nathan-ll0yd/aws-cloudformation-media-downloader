import AWSXRay from 'aws-xray-sdk-core'
import type {Context} from 'aws-lambda'

let xrayClient: typeof AWSXRay | undefined

/**
 * Gets the X-Ray client instance using lazy initialization
 * This prevents aws-xray-sdk-core from loading during Jest module validation
 */
function getXRayClient(): typeof AWSXRay {
  if (!xrayClient) {
    xrayClient = AWSXRay
  }
  return xrayClient
}

/**
 * Gets the current X-Ray segment for the Lambda invocation
 * Returns undefined if X-Ray tracing is not active
 *
 * @example
 * ```typescript
 * const segment = getSegment()
 * const subsegment = segment?.addNewSubsegment('custom-operation')
 * // ... perform operation
 * subsegment?.close()
 * ```
 */
export function getSegment() {
  const xray = getXRayClient()
  return xray.getSegment()
}

/**
 * Check if X-Ray tracing is enabled
 * X-Ray is disabled for LocalStack (unsupported) and when ENABLE_XRAY=false
 * @returns true if X-Ray should be enabled
 */
function isXRayEnabled(): boolean {
  return process.env.ENABLE_XRAY !== 'false' && process.env.USE_LOCALSTACK !== 'true'
}

/**
 * Wrap an AWS SDK v3 client with X-Ray instrumentation
 * Returns the client unchanged if X-Ray is disabled
 *
 * @param client - AWS SDK v3 client to wrap
 * @returns X-Ray instrumented client or original client
 *
 * @example
 * ```typescript
 * const s3Client = new S3Client({region: 'us-west-2'})
 * const instrumentedClient = captureAWSClient(s3Client)
 * ```
 */
export function captureAWSClient<T extends {middlewareStack: {remove: unknown; use: unknown}; config: unknown}>(client: T): T {
  if (!isXRayEnabled()) {
    return client
  }
  const xray = getXRayClient()
  return xray.captureAWSv3Client(client)
}

/**
 * Higher-order function that wraps Lambda handlers with X-Ray tracing
 * Extracts trace ID from X-Ray segment or falls back to AWS request ID
 *
 * @param handler - Lambda handler function that receives event, context, and metadata
 * @returns Wrapped handler compatible with AWS Lambda runtime
 *
 * @example
 * ```typescript
 * export const handler = withXRay(async (event, context, {traceId}) => {
 *   logInfo('Processing request', {traceId})
 *   // ... handler logic
 * })
 * ```
 */
export function withXRay<TEvent = any, TResult = any>(
  handler: (event: TEvent, context: Context, metadata: {traceId: string}) => Promise<TResult>
) {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    const xray = getXRayClient()
    const segment = xray.getSegment()
    const traceId = (segment as any)?.trace_id || context.awsRequestId

    return handler(event, context, {traceId})
  }
}
