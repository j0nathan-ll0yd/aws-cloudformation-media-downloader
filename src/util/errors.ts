export class CustomLambdaError extends Error {
  errors: object
  statusCode: number
}

export class ValidationError extends CustomLambdaError {
  constructor(message: string, errors?, statusCode = 400) {
    super(message)
    if (errors) {
      this.errors = errors
    }
    this.name = 'ValidationError'
    this.statusCode = statusCode
  }
}

export class ServiceUnavailableError extends CustomLambdaError {
  constructor(message: string, statusCode = 503) {
    super(message)
    this.name = 'ServiceUnavailableError'
    this.statusCode = statusCode
  }
}
