export class ValidationError extends Error {
  statusCode: number
  errors: object
  constructor(message: string, errors?, statusCode = 400) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
    this.statusCode = statusCode
  }
}

export class ServiceUnavailableError extends Error {
  statusCode: number
  errors: object
  constructor(message: string, statusCode = 503) {
    super(message)
    this.name = 'ServiceUnavailableError'
    this.statusCode = statusCode
  }
}
