export class CustomLambdaError extends Error {
  errors: object
  statusCode: number
}

// Called when the client request is invalid (usually via validate.js)
export class ValidationError extends CustomLambdaError {
  constructor(message: string, errors?: object, statusCode = 400) {
    super(message)
    if (errors) {
      this.errors = errors
    }
    this.name = 'ValidationError'
    this.statusCode = statusCode
  }
}

// Called when the platform hasn't been configured for push
export class ServiceUnavailableError extends CustomLambdaError {
  constructor(message: string, statusCode = 503) {
    super(message)
    this.name = 'ServiceUnavailableError'
    this.statusCode = statusCode
  }
}

// Called when a lambda can't extract UserID from the header
export class UnauthorizedError extends CustomLambdaError {
  constructor(message: string, statusCode = 401) {
    super(message)
    this.name = 'UnauthorizedError'
    this.statusCode = statusCode
  }
}

// The video, or related metadata needed, doesn't exist or can't be found
export class NotFoundError extends CustomLambdaError {
  constructor(message: string, statusCode = 404) {
    super(message)
    this.name = 'NotFoundError'
    this.statusCode = statusCode
  }
}

// The "catchall" error message; for anything unexpected
export class UnexpectedError extends CustomLambdaError {
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = 'UnexpectedError'
    this.statusCode = statusCode
  }
}
