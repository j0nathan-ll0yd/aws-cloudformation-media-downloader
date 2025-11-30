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
 * Check if X-Ray tracing is enabled
 * X-Ray is disabled for LocalStack (unsupported) and when ENABLE_XRAY=false
 * @returns true if X-Ray should be enabled
 */
function isXRayEnabled(): boolean {
  return process.env.ENABLE_XRAY !== 'false' && process.env.USE_LOCALSTACK !== 'true'
}

/**
 * Gets the current X-Ray segment for the Lambda invocation
 * Returns undefined if X-Ray tracing is not active or disabled
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/X-Ray-Integration#custom-subsegments | X-Ray Custom Subsegments}
 */
export function getSegment() {
  if (!isXRayEnabled()) {
    return undefined
  }
  try {
    const xray = getXRayClient()
    return xray.getSegment()
  } catch {
    return undefined
  }
}

/**
 * Wrap an AWS SDK v3 client with X-Ray instrumentation
 * Returns the client unchanged if X-Ray is disabled
 *
 * @param client - AWS SDK v3 client to wrap
 * @returns X-Ray instrumented client or original client
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/X-Ray-Integration#aws-sdk-integration | X-Ray AWS SDK Integration}
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
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/X-Ray-Integration#lambda-usage | X-Ray Lambda Usage}
 */
export function withXRay<TEvent = unknown, TResult = unknown>(handler: (event: TEvent, context: Context, metadata?: {traceId: string}) => Promise<TResult>) {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    let traceId = context.awsRequestId

    // Only attempt to get X-Ray segment if X-Ray is enabled
    // This prevents errors during Jest tests where X-Ray context doesn't exist
    if (isXRayEnabled()) {
      try {
        const xray = getXRayClient()
        const segment = xray.getSegment()
        // X-Ray segment has trace_id property but it's not in the type definitions
        traceId = (segment as {trace_id?: string} | undefined)?.trace_id || context.awsRequestId
      } catch {
        // X-Ray segment not available, use request ID
      }
    }

    return handler(event, context, {traceId})
  }
}
