/**
 * Authenticated Handler Base Class
 *
 * Base class for API Gateway handlers that require authentication.
 * Automatically extracts and validates user identity from the request context.
 * Returns 401 for unauthenticated or anonymous requests.
 * Catches all errors and converts them to appropriate HTTP responses.
 */
import type {APIGatewayProxyResult, Context} from 'aws-lambda'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {getUserDetailsFromEvent} from '#lib/lambda/context'
import {extractCorrelationId} from '#lib/lambda/correlation'
import {buildErrorResponse} from '#lib/lambda/responses'
import {logIncomingFixture, logOutgoingFixture} from '#lib/system/observability'
import {UnauthorizedError} from '#lib/system/errors'
import {UserStatus} from '#types/enums'
import {BaseHandler, InjectContext, logger, LogMetrics, metrics, MetricUnit, Traced} from './BaseHandler'
import {addAnnotation} from '#lib/vendor/OpenTelemetry'
import type {Span} from '@opentelemetry/api'

/**
 * Abstract base class for authenticated API Gateway handlers
 *
 * Provides:
 * - User ID extraction and validation
 * - Automatic authorization check (rejects Unauthenticated/Anonymous)
 * - User ID annotation in traces
 * - Automatic error-to-response conversion
 *
 * @example
 * ```typescript
 * class UserDeleteHandler extends AuthenticatedHandler {
 *   readonly operationName = 'UserDelete'
 *
 *   protected async handleAuthenticated(event, context): Promise<APIGatewayProxyResult> {
 *     // this.userId is guaranteed to be a valid string
 *     await deleteUser(this.userId)
 *     return buildValidatedResponse(context, 204)
 *   }
 * }
 *
 * const handlerInstance = new UserDeleteHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
 */
export abstract class AuthenticatedHandler extends BaseHandler<
  CustomAPIGatewayRequestAuthorizerEvent,
  APIGatewayProxyResult
> {
  /** Authenticated user ID (guaranteed non-null after execute) */
  protected userId!: string
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
  public async handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
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
      logOutgoingFixture(result)
      return result
    } catch (error) {
      logger.error('Handler failed', {error, operationName: this.operationName})
      const {userId: errorUserId} = getUserDetailsFromEvent(event)
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {userId: errorUserId, path: event.path, httpMethod: event.httpMethod})
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }

  /**
   * Execute with authentication validation
   * Extracts user details and validates authentication before calling handleAuthenticated
   */
  protected async execute(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    const {userId, userStatus} = getUserDetailsFromEvent(event)
    if (userStatus === UserStatus.Unauthenticated || userStatus === UserStatus.Anonymous) {
      logger.warn('Authorization denied', {userStatus: UserStatus[userStatus]})
      throw new UnauthorizedError()
    }
    this.userId = userId as string
    addAnnotation(this.span, 'userId', this.userId)
    logger.appendKeys({userId: this.userId})
    return this.handleAuthenticated(event, context)
  }

  /**
   * Handle the authenticated request
   * Subclasses must implement this method
   * this.userId is guaranteed to be a valid string when this is called
   */
  protected abstract handleAuthenticated(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult>
}
