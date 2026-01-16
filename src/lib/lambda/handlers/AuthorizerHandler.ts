/**
 * Authorizer Handler Base Class
 *
 * Base class for API Gateway custom authorizers.
 * Returns IAM policies for Allow/Deny decisions.
 * Throws Error('Unauthorized') for 401 responses.
 */
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult} from 'aws-lambda'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {extractCorrelationId} from '../correlation'
import {logIncomingFixture} from '#lib/system/observability'
import type {Span} from '@opentelemetry/api'

/**
 * Abstract base class for API Gateway custom authorizers
 *
 * Provides:
 * - Standard observability (metrics, traces)
 * - Correlation ID extraction
 * - Lets 'Unauthorized' errors propagate (API Gateway returns 401)
 *
 * @example
 * ```typescript
 * class ApiGatewayAuthorizerHandler extends AuthorizerHandler {
 *   readonly operationName = 'ApiGatewayAuthorizer'
 *
 *   protected async authorize(event, context): Promise<CustomAuthorizerResult> {
 *     // Validate API key and session
 *     if (!event.queryStringParameters?.ApiKey) {
 *       throw new Error('Unauthorized')  // Returns 401
 *     }
 *     // Return Allow policy
 *     return {
 *       principalId: userId,
 *       policyDocument: { ... }
 *     }
 *   }
 * }
 *
 * const handlerInstance = new ApiGatewayAuthorizerHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
 */
export abstract class AuthorizerHandler extends BaseHandler<APIGatewayRequestAuthorizerEvent, CustomAuthorizerResult> {
  /** Active span for tracing */
  protected span: Span | null = null
  /** Correlation ID for request tracing */
  protected correlationId!: string
  /** Trace ID for distributed tracing */
  protected traceId!: string

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: APIGatewayRequestAuthorizerEvent, context: Context): Promise<CustomAuthorizerResult> {
    const {traceId, correlationId} = extractCorrelationId(event, context)
    this.correlationId = correlationId
    this.traceId = traceId
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    metrics.addMetric(`${this.operationName}Attempt`, MetricUnit.Count, 1)
    logger.info('Handler invoked', {operationName: this.operationName})
    try {
      const result = await this.execute(event, context)
      metrics.addMetric(`${this.operationName}Success`, MetricUnit.Count, 1)
      return result
    } catch (error) {
      // Let 'Unauthorized' errors propagate (API Gateway returns 401)
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw error
      }
      // Log unexpected errors and rethrow
      logger.error('Handler failed', {error, operationName: this.operationName})
      throw error
    }
  }

  /** Execute the authorizer - delegates to authorize */
  protected async execute(event: APIGatewayRequestAuthorizerEvent, context: Context): Promise<CustomAuthorizerResult> {
    return this.authorize(event, context)
  }

  /**
   * Authorize the request
   * Subclasses must implement this method
   * Throw new Error('Unauthorized') to return 401
   * Return CustomAuthorizerResult with Allow/Deny policy
   */
  protected abstract authorize(event: APIGatewayRequestAuthorizerEvent, context: Context): Promise<CustomAuthorizerResult>
}
