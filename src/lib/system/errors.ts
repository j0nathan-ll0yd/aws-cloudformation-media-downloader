import type {Notification} from 'apns2'
import type {ErrorContext} from '#types/errorContext'

/**
 * Base error class for Lambda handlers with HTTP status codes and context.
 * Extends native Error with additional properties for API responses and debugging.
 */
export class CustomLambdaError extends Error {
  errors: object | undefined
  statusCode: number | undefined
  code: string | undefined
  override cause?: Error
  context?: ErrorContext

  constructor(message: string, options?: {cause?: Error; context?: ErrorContext}) {
    super(message)
    if (options?.cause) {
      this.cause = options.cause
    }
    if (options?.context) {
      this.context = options.context
    }
  }

  /**
   * Attach or merge error context for debugging and observability.
   * Returns `this` for method chaining.
   */
  withContext(context: ErrorContext): this {
    this.context = {...this.context, ...context}
    return this
  }
}

// Called when the client request is invalid (usually via Joi validation)
export class ValidationError extends CustomLambdaError {
  constructor(message: string, errors?: object, statusCode = 400, cause?: Error) {
    super(message, {cause})
    if (errors) {
      this.errors = errors
    }
    this.name = 'ValidationError'
    this.code = 'VALIDATION_ERROR'
    this.statusCode = statusCode
  }
}

// Called when the platform hasn't been configured for push
export class ServiceUnavailableError extends CustomLambdaError {
  constructor(message: string, statusCode = 503, cause?: Error) {
    super(message, {cause})
    this.name = 'ServiceUnavailableError'
    this.code = 'SERVICE_UNAVAILABLE'
    this.statusCode = statusCode
  }
}

// Called when a lambda can't extract UserID from the header
export class UnauthorizedError extends CustomLambdaError {
  constructor(message: string = 'Invalid Authentication token; login', statusCode = 401, cause?: Error) {
    super(message, {cause})
    this.name = 'UnauthorizedError'
    this.code = 'UNAUTHORIZED'
    this.statusCode = statusCode
  }
}

// Called when the user is authenticated but not allowed to access the resource
export class ForbiddenError extends CustomLambdaError {
  constructor(message: string = 'Access denied', statusCode = 403, cause?: Error) {
    super(message, {cause})
    this.name = 'ForbiddenError'
    this.code = 'FORBIDDEN'
    this.statusCode = statusCode
  }
}

// The video, or related metadata needed, doesn't exist or can't be found
export class NotFoundError extends CustomLambdaError {
  constructor(message: string, statusCode = 404, cause?: Error) {
    super(message, {cause})
    this.name = 'NotFoundError'
    this.code = 'NOT_FOUND'
    this.statusCode = statusCode
  }
}

// The "catchall" error message; for anything unexpected
export class UnexpectedError extends CustomLambdaError {
  constructor(message: string, statusCode = 500, cause?: Error) {
    super(message, {cause})
    this.name = 'UnexpectedError'
    this.code = 'INTERNAL_ERROR'
    this.statusCode = statusCode
  }
}

// Database operation failed - sanitizes SQL queries from client response
export class DatabaseError extends CustomLambdaError {
  queryName: string
  originalMessage: string

  constructor(queryName: string, originalError: Error) {
    // Sanitize message - never expose SQL to clients
    super('Database operation failed', {cause: originalError})
    this.name = 'DatabaseError'
    this.code = 'DATABASE_ERROR'
    this.statusCode = 500
    this.queryName = queryName
    this.originalMessage = originalError.message
  }
}

// Cookie expiration or bot detection error from YouTube
export class CookieExpirationError extends CustomLambdaError {
  constructor(message: string, statusCode = 403, cause?: Error) {
    super(message, {cause})
    this.name = 'CookieExpirationError'
    this.code = 'COOKIE_EXPIRED'
    this.statusCode = statusCode
  }
}

// The errors thrown by node-apns2 (when sending push health checks)
export class Apns2Error extends Error {
  notification: Notification
  reason: string
  statusCode: number
  constructor(reason: string, statusCode: number, notification: Notification) {
    super()
    this.reason = reason
    this.notification = notification
    this.statusCode = statusCode
  }
}

export const providerFailureErrorMessage = 'AWS request failed'
