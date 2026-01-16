/**
 * API Handler Base Class
 *
 * Base class for API Gateway handlers that do NOT require authentication.
 * Used for public endpoints like login, registration, webhooks.
 * Catches all errors and converts them to appropriate HTTP responses.
 */
import type {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import {extractCorrelationId} from '#lib/lambda/correlation'
import {buildErrorResponse} from '#lib/lambda/responses'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import type {Span} from '@opentelemetry/api'

/**
 * Abstract base class for unauthenticated API Gateway handlers
 *
 * Provides:
 * - Correlation ID extraction and logging
 * - Automatic error-to-response conversion
 * - Fixture logging for debugging
 *
 * @example
 * ```typescript
 * class LoginUserHandler extends ApiHandler {
 *   readonly operationName = 'LoginUser'
 *
 *   protected async handleRequest(event, context): Promise<APIGatewayProxyResult> {
 *     // Business logic here
 *     return buildValidatedResponse(context, 200, {token: '...'})
 *   }
 * }
 *
 * const handlerInstance = new LoginUserHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
 */
export abstract class ApiHandler<TEvent = APIGatewayProxyEvent> extends BaseHandler<
  TEvent,
  APIGatewayProxyResult
> {
  /** Active span for tracing */
  protected span: Span | null = null

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: TEvent, context: Context): Promise<APIGatewayProxyResult> {
    const {traceId, correlationId} = extractCorrelationId(event, context)
    logger.appendKeys({correlationId, traceId})
    logIncomingFixture(event)
    metrics.addMetric(`${this.operationName}Attempt`, MetricUnit.Count, 1)
    logger.info('Handler invoked', {operationName: this.operationName})
    try {
      const result = await this.execute(event, context)
      metrics.addMetric(`${this.operationName}Success`, MetricUnit.Count, 1)
      logOutgoingFixture(result)
      return result
    } catch (error) {
      logger.error('Handler failed', {error, operationName: this.operationName})
      const apiEvent = event as APIGatewayProxyEvent
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {path: apiEvent.path, httpMethod: apiEvent.httpMethod})
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }

  /** Execute the handler business logic - delegates to handleRequest */
  protected async execute(event: TEvent, context: Context): Promise<APIGatewayProxyResult> {
    return this.handleRequest(event, context)
  }

  /**
   * Handle the request
   * Subclasses must implement this method
   */
  protected abstract handleRequest(event: TEvent, context: Context): Promise<APIGatewayProxyResult>
}
