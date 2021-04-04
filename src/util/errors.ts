export function ValidationError(message, statusCode = 400, errors?) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = message
  this.statusCode = statusCode
  this.errors = errors
  if (errors) { this.message = errors }
}
