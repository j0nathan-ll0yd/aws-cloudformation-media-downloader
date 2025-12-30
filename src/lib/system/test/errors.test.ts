import {describe, expect, test} from 'vitest'
import {
  CookieExpirationError,
  CustomLambdaError,
  ForbiddenError,
  NotFoundError,
  providerFailureErrorMessage,
  ServiceUnavailableError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError
} from './../errors'

describe('Error Classes', () => {
  describe('CustomLambdaError', () => {
    test('should create error with message', () => {
      const error = new CustomLambdaError('Test error')
      expect(error.message).toEqual('Test error')
      expect(error).toBeInstanceOf(Error)
    })

    test('should support cause chaining', () => {
      const cause = new Error('Original error')
      const error = new CustomLambdaError('Wrapped error', {cause})
      expect(error.cause).toBe(cause)
    })
  })

  describe('ValidationError', () => {
    test('should default to 400 status code', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toEqual(400)
      expect(error.name).toEqual('ValidationError')
      expect(error.code).toEqual('VALIDATION_ERROR')
    })

    test('should include validation errors object', () => {
      const validationErrors = {email: 'Invalid email format', password: 'Too short'}
      const error = new ValidationError('Validation failed', validationErrors)
      expect(error.errors).toEqual(validationErrors)
    })

    test('should allow custom status code', () => {
      const error = new ValidationError('Custom validation', undefined, 422)
      expect(error.statusCode).toEqual(422)
    })
  })

  describe('UnauthorizedError', () => {
    test('should default to 401 status code with default message', () => {
      const error = new UnauthorizedError()
      expect(error.statusCode).toEqual(401)
      expect(error.message).toEqual('Invalid Authentication token; login')
      expect(error.name).toEqual('UnauthorizedError')
      expect(error.code).toEqual('UNAUTHORIZED')
    })

    test('should accept custom message', () => {
      const error = new UnauthorizedError('Session expired')
      expect(error.message).toEqual('Session expired')
      expect(error.statusCode).toEqual(401)
    })
  })

  describe('ForbiddenError', () => {
    test('should default to 403 status code with default message', () => {
      const error = new ForbiddenError()
      expect(error.statusCode).toEqual(403)
      expect(error.message).toEqual('Access denied')
      expect(error.name).toEqual('ForbiddenError')
      expect(error.code).toEqual('FORBIDDEN')
    })

    test('should accept custom message', () => {
      const error = new ForbiddenError('You do not have permission')
      expect(error.message).toEqual('You do not have permission')
      expect(error.statusCode).toEqual(403)
    })
  })

  describe('NotFoundError', () => {
    test('should default to 404 status code', () => {
      const error = new NotFoundError('Resource not found')
      expect(error.statusCode).toEqual(404)
      expect(error.name).toEqual('NotFoundError')
      expect(error.message).toEqual('Resource not found')
      expect(error.code).toEqual('NOT_FOUND')
    })
  })

  describe('UnexpectedError', () => {
    test('should default to 500 status code', () => {
      const error = new UnexpectedError('Something went wrong')
      expect(error.statusCode).toEqual(500)
      expect(error.name).toEqual('UnexpectedError')
      expect(error.code).toEqual('INTERNAL_ERROR')
    })

    test('should support cause chaining', () => {
      const cause = new Error('Database connection failed')
      const error = new UnexpectedError('Operation failed', 500, cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe('CookieExpirationError', () => {
    test('should default to 403 status code', () => {
      const error = new CookieExpirationError('Cookie expired or bot detected')
      expect(error.statusCode).toEqual(403)
      expect(error.name).toEqual('CookieExpirationError')
      expect(error.code).toEqual('COOKIE_EXPIRED')
    })
  })

  describe('ServiceUnavailableError', () => {
    test('should default to 503 status code', () => {
      const error = new ServiceUnavailableError('APNS not configured')
      expect(error.statusCode).toEqual(503)
      expect(error.name).toEqual('ServiceUnavailableError')
      expect(error.code).toEqual('SERVICE_UNAVAILABLE')
    })
  })

  describe('providerFailureErrorMessage', () => {
    test('should be exported as constant', () => {
      expect(providerFailureErrorMessage).toEqual('AWS request failed')
    })
  })
})
