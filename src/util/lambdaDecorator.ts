import {Context} from 'aws-lambda'
import AWSXRay from 'aws-xray-sdk-core'

export interface XRayContext {
  traceId?: string
}

type LambdaHandler<TEvent, TResult> = (event: TEvent, context: Context, xrayContext: XRayContext) => Promise<TResult>

/**
 * Wraps a Lambda handler with X-Ray tracing instrumentation
 * @param handler - The Lambda handler function to wrap
 * @returns Wrapped handler with automatic X-Ray segment management
 * @notExported
 */
export function withXRay<TEvent, TResult>(handler: LambdaHandler<TEvent, TResult>) {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    const enableXRay = process.env.ENABLE_XRAY !== 'false'

    if (!enableXRay) {
      return handler(event, context, {})
    }

    const segmentOrSubsegment = AWSXRay.getSegment()
    const segment = segmentOrSubsegment && 'trace_id' in segmentOrSubsegment ? segmentOrSubsegment : segmentOrSubsegment?.segment
    const traceId = segment?.trace_id

    try {
      return await handler(event, context, {traceId})
    } catch (error) {
      if (segmentOrSubsegment && error instanceof Error) {
        segmentOrSubsegment.addError(error)
      }
      throw error
    }
  }
}
