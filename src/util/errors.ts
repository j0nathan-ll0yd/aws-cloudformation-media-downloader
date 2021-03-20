export class ValidationError extends Error {
  get code(): number {
    return this._code
  }
  private readonly _code: number
  constructor(code: number, message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ValidationError'
    this._code = code
  }
}
