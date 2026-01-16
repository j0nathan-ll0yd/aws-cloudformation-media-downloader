/**
 * Optional Auth Handler Base Class
 *
 * Base class for API Gateway handlers that work with or without authentication.
 * Extracts user details but does not require authentication.
 * Useful for handlers that show different content based on auth status.
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
 * Abstract base class for optionally authenticated API Gateway handlers
 *
 * Provides:
 * - User ID extraction (may be undefined for anonymous users)
 * - User status tracking (Authenticated, Unauthenticated, Anonymous)
 * - User ID annotation in traces when available
 * - Automatic error-to-response conversion
 *
 * @example
 * ```typescript
 * class ListFilesHandler extends OptionalAuthHandler {
 *   readonly operationName = 'ListFiles'
 *
 *   protected async handleRequest(event, context): Promise<APIGatewayProxyResult> {
 *     if (this.userStatus === UserStatus.Anonymous) {
 *       return buildValidatedResponse(context, 200, {files: getDefaultFiles()})
 *     }
 *     const files = await getFilesByUser(this.userId!)
 *     return buildValidatedResponse(context, 200, {files})
 *   }
 * }
 *
 * const handlerInstance = new ListFilesHandler()
 * export const handler = handlerInstance.handler.bind(handlerInstance)
 * ```
 */
export abstract class OptionalAuthHandler extends BaseHandler<
  CustomAPIGatewayRequestAuthorizerEvent,
  APIGatewayProxyResult
> {
  /** User ID (undefined for anonymous users) */
  protected userId?: string
  /** Authentication status of the current request */
  protected userStatus!: UserStatus
  /** Active span for tracing */
  protected span: Span | null = null

  /** Main handler entry point with decorators applied */
  @LogMetrics({captureColdStartMetric: true})
  @InjectContext()
  @Traced()
  public async handler(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
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
      const {userId: errorUserId} = getUserDetailsFromEvent(event)
      const errorResult = buildErrorResponse(context, error, {traceId, correlationId}, {userId: errorUserId, path: event.path, httpMethod: event.httpMethod})
      logOutgoingFixture(errorResult)
      return errorResult
    }
  }

  /**
   * Execute with optional authentication
   * Extracts user details and sets class properties before calling handleRequest
   * Rejects only Unauthenticated users (invalid token); allows Anonymous through
   */
  protected async execute(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult> {
    const {userId, userStatus} = getUserDetailsFromEvent(event)
    // Reject only Unauthenticated (invalid token)
    if (userStatus === UserStatus.Unauthenticated) {
      logger.warn('Authorization denied', {userStatus: UserStatus[userStatus]})
      throw new UnauthorizedError()
    }
    // Allow Anonymous and Authenticated through
    this.userId = userId
    this.userStatus = userStatus
    addAnnotation(this.span, 'userStatus', UserStatus[userStatus])
    if (userId) {
      addAnnotation(this.span, 'userId', userId)
      logger.appendKeys({userId})
    }
    return this.handleRequest(event, context)
  }

  /**
   * Handle the request
   * Subclasses must implement this method
   * this.userId may be undefined for anonymous users
   * this.userStatus indicates the authentication state
   */
  protected abstract handleRequest(event: CustomAPIGatewayRequestAuthorizerEvent, context: Context): Promise<APIGatewayProxyResult>
}
