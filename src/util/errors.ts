import {Notification} from 'apns2'

export class CustomLambdaError extends Error {
  errors: object | undefined
  statusCode: number | undefined
  override cause?: Error

  constructor(message: string, options?: {cause?: Error}) {
    super(message)
    if (options?.cause) {
      this.cause = options.cause
    }
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
    this.statusCode = statusCode
  }
}

// Called when the platform hasn't been configured for push
export class ServiceUnavailableError extends CustomLambdaError {
  constructor(message: string, statusCode = 503, cause?: Error) {
    super(message, {cause})
    this.name = 'ServiceUnavailableError'
    this.statusCode = statusCode
  }
}

// Called when a lambda can't extract UserID from the header
export class UnauthorizedError extends CustomLambdaError {
  constructor(message: string = UNAUTHORIZED_ERROR_MESSAGE, statusCode = 401, cause?: Error) {
    super(message, {cause})
    this.name = 'UnauthorizedError'
    this.statusCode = statusCode
  }
}

// The video, or related metadata needed, doesn't exist or can't be found
export class NotFoundError extends CustomLambdaError {
  constructor(message: string, statusCode = 404, cause?: Error) {
    super(message, {cause})
    this.name = 'NotFoundError'
    this.statusCode = statusCode
  }
}

// The "catchall" error message; for anything unexpected
export class UnexpectedError extends CustomLambdaError {
  constructor(message: string, statusCode = 500, cause?: Error) {
    super(message, {cause})
    this.name = 'UnexpectedError'
    this.statusCode = statusCode
  }
}

// Cookie expiration or bot detection error from YouTube
export class CookieExpirationError extends CustomLambdaError {
  constructor(message: string, statusCode = 403, cause?: Error) {
    super(message, {cause})
    this.name = 'CookieExpirationError'
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
export const UNAUTHORIZED_ERROR_MESSAGE = 'Invalid Authentication token; login'
