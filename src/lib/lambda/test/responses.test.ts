import {describe, expect, test} from 'vitest'
import {ValidationError} from '#lib/system/errors'
import {createMockContext} from '#util/vitest-setup'
import {buildApiResponse, getErrorMessage} from './../responses'

describe('Response Helpers', () => {
  const mockContext = createMockContext({awsRequestId: 'test-request-id-123'})

  describe('getErrorMessage', () => {
    test('should extract message from Error instance', () => {
      const error = new Error('Something went wrong')
      expect(getErrorMessage(error)).toEqual('Something went wrong')
    })

    test('should return string directly', () => {
      expect(getErrorMessage('Direct error message')).toEqual('Direct error message')
    })

    test('should stringify objects', () => {
      const errorObj = {code: 'ERR_001', details: 'Invalid input'}
      expect(getErrorMessage(errorObj)).toEqual(JSON.stringify(errorObj))
    })

    test('should handle non-serializable values', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      // Should not throw, should return string representation
      expect(typeof getErrorMessage(circular)).toBe('string')
    })
  })

  describe('buildApiResponse', () => {
    describe('success responses (2xx)', () => {
      test('should format 200 response with body', () => {
        const result = buildApiResponse(mockContext, 200, {status: 'success', data: 'test'})

        expect(result.statusCode).toEqual(200)
        const body = JSON.parse(result.body)
        expect(body.body.status).toEqual('success')
        expect(body.body.data).toEqual('test')
        expect(body.requestId).toEqual('test-request-id-123')
      })

      test('should format 201 response with body', () => {
        const result = buildApiResponse(mockContext, 201, {id: 'new-resource-123'})

        expect(result.statusCode).toEqual(201)
        const body = JSON.parse(result.body)
        expect(body.body.id).toEqual('new-resource-123')
      })

      test('should format 204 response with empty body', () => {
        const result = buildApiResponse(mockContext, 204)

        expect(result.statusCode).toEqual(204)
        expect(result.body).toEqual('')
      })
    })

    describe('client error responses (4xx)', () => {
      test('should format 400 response with error wrapper', () => {
        const result = buildApiResponse(mockContext, 400, 'Invalid request body')

        expect(result.statusCode).toEqual(400)
        const body = JSON.parse(result.body)
        expect(body.error.code).toEqual('custom-4XX-generic')
        expect(body.error.message).toEqual('Invalid request body')
        expect(body.requestId).toEqual('test-request-id-123')
      })

      test('should format 401 response', () => {
        const result = buildApiResponse(mockContext, 401, 'Unauthorized')

        expect(result.statusCode).toEqual(401)
        const body = JSON.parse(result.body)
        expect(body.error.code).toEqual('custom-4XX-generic')
        expect(body.error.message).toEqual('Unauthorized')
      })

      test('should format 404 response', () => {
        const result = buildApiResponse(mockContext, 404, 'Resource not found')

        expect(result.statusCode).toEqual(404)
        const body = JSON.parse(result.body)
        expect(body.error.message).toEqual('Resource not found')
      })
    })

    describe('server error responses (5xx)', () => {
      test('should format 500 response with error wrapper', () => {
        const result = buildApiResponse(mockContext, 500, 'Internal server error')

        expect(result.statusCode).toEqual(500)
        const body = JSON.parse(result.body)
        expect(body.error.code).toEqual('custom-5XX-generic')
        expect(body.error.message).toEqual('Internal server error')
      })

      test('should format 503 response', () => {
        const result = buildApiResponse(mockContext, 503, 'Service unavailable')

        expect(result.statusCode).toEqual(503)
        const body = JSON.parse(result.body)
        expect(body.error.code).toEqual('custom-5XX-generic')
      })
    })

    describe('Error object handling', () => {
      test('should handle standard Error instance', () => {
        const error = new Error('Something went wrong')
        const result = buildApiResponse(mockContext, error)

        expect(result.statusCode).toEqual(500)
        const body = JSON.parse(result.body)
        expect(body.error.message).toEqual('Something went wrong')
      })

      test('should use statusCode from CustomLambdaError', () => {
        const error = new ValidationError('Invalid email format')
        const result = buildApiResponse(mockContext, error)

        expect(result.statusCode).toEqual(400)
        const body = JSON.parse(result.body)
        expect(body.error.message).toEqual('Invalid email format')
      })

      test('should use validation errors from ValidationError if present', () => {
        const error = new ValidationError('Validation failed', {email: 'Invalid format', password: 'Too short'})
        const result = buildApiResponse(mockContext, error)

        expect(result.statusCode).toEqual(400)
        const body = JSON.parse(result.body)
        expect(body.error.message.email).toEqual('Invalid format')
        expect(body.error.message.password).toEqual('Too short')
      })
    })

    describe('Plain object error handling', () => {
      test('should handle Better Auth style error objects with status', () => {
        const errorObj = {status: 404, message: 'User not found'}
        const result = buildApiResponse(mockContext, errorObj)

        expect(result.statusCode).toEqual(404)
        const body = JSON.parse(result.body)
        expect(body.error.message).toEqual('User not found')
      })

      test('should handle error objects with statusCode property', () => {
        const errorObj = {statusCode: 403, message: 'Forbidden'}
        const result = buildApiResponse(mockContext, errorObj)

        expect(result.statusCode).toEqual(403)
        const body = JSON.parse(result.body)
        expect(body.error.message).toEqual('Forbidden')
      })

      test('should default to 500 for objects without status', () => {
        const errorObj = {error: 'Unknown error occurred'}
        const result = buildApiResponse(mockContext, errorObj)

        expect(result.statusCode).toEqual(500)
      })
    })

    describe('Unknown error type handling', () => {
      test('should handle undefined gracefully', () => {
        const result = buildApiResponse(mockContext, undefined)

        expect(result.statusCode).toEqual(500)
      })

      test('should handle null gracefully', () => {
        const result = buildApiResponse(mockContext, null)

        expect(result.statusCode).toEqual(500)
      })
    })
  })
})
