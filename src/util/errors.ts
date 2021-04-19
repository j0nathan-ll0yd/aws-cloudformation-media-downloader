// eslint-disable-next-line @typescript-eslint/ban-types
export function ValidationError(message: string, statusCode = 400, errors?: object): void {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = message
  this.statusCode = statusCode
  this.errors = errors
  if (errors) { this.message = errors }
}
