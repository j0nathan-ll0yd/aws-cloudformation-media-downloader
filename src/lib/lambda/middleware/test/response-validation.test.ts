import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {z} from 'zod'

describe('Lambda:Middleware:ResponseValidation', () => {
  let originalNodeEnv: string | undefined
  let originalLogLevel: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    originalLogLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'SILENT'
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
    vi.resetModules()
  })

  const testResponseSchema = z.object({id: z.string(), name: z.string()})
  const mockContext = {awsRequestId: 'test-request-id', functionName: 'TestHandler'} as Context

  describe('validateResponse', () => {
    it('should pass silently for valid response', async () => {
      process.env.NODE_ENV = 'development'
      const {validateResponse} = await import('../apiGateway')

      const validResponse = {id: '123', name: 'Test'}
      expect(() => validateResponse(validResponse, testResponseSchema)).not.toThrow()
    })

    it('should throw ValidationError in NODE_ENV=development for invalid response', async () => {
      process.env.NODE_ENV = 'development'
      const {validateResponse} = await import('../apiGateway')

      const invalidResponse = {id: 123, name: 'Test'} // id should be string
      expect(() => validateResponse(invalidResponse, testResponseSchema)).toThrow('Response validation failed')
    })

    it('should throw ValidationError in NODE_ENV=test for invalid response', async () => {
      process.env.NODE_ENV = 'test'
      const {validateResponse} = await import('../apiGateway')

      const invalidResponse = {id: '123'} // missing required name
      expect(() => validateResponse(invalidResponse, testResponseSchema)).toThrow('Response validation failed')
    })

    it('should not throw in NODE_ENV=production for invalid response', async () => {
      process.env.NODE_ENV = 'production'
      const {validateResponse} = await import('../apiGateway')

      const invalidResponse = {id: 123, name: 'Test'}
      // In production, validation failures are logged as warnings but don't throw
      expect(() => validateResponse(invalidResponse, testResponseSchema)).not.toThrow()
    })

    it('should not throw when NODE_ENV is empty for invalid response', async () => {
      delete process.env.NODE_ENV
      const {validateResponse} = await import('../apiGateway')

      const invalidResponse = {id: 123}
      // When NODE_ENV is empty, defaults to production behavior (warning, no throw)
      expect(() => validateResponse(invalidResponse, testResponseSchema)).not.toThrow()
    })
  })

  describe('buildValidatedResponse', () => {
    it('should validate and return response for 2xx status codes', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      const validResponse = {id: '123', name: 'Test'}
      const result = buildValidatedResponse(mockContext, 200, validResponse, testResponseSchema)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body).toEqual(validResponse)
    })

    it('should throw for invalid 2xx response in development', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      // Type assertion needed because we're intentionally passing invalid data to test validation
      const invalidResponse = {id: 123, name: 'Test'} as unknown as {id: string; name: string}
      expect(() => buildValidatedResponse(mockContext, 200, invalidResponse, testResponseSchema)).toThrow('Response validation failed')
    })

    it('should skip validation for 4xx error responses', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      // Even with invalid data, 4xx should not validate - type assertion for intentionally invalid data
      const invalidResponse = {id: 123, name: 'Test'} as unknown as {id: string; name: string}
      const result = buildValidatedResponse(mockContext, 400, invalidResponse, testResponseSchema)

      expect(result.statusCode).toBe(400)
    })

    it('should skip validation for 5xx error responses', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      // Type assertion for intentionally invalid data
      const invalidResponse = {id: 123} as unknown as {id: string; name: string}
      const result = buildValidatedResponse(mockContext, 500, invalidResponse, testResponseSchema)

      expect(result.statusCode).toBe(500)
    })

    it('should skip validation when no schema provided', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      const anyResponse = {anything: 'works', without: 'schema'}
      const result = buildValidatedResponse(mockContext, 200, anyResponse)

      expect(result.statusCode).toBe(200)
    })

    it('should validate 201 status code (2xx range)', async () => {
      process.env.NODE_ENV = 'development'
      const {buildValidatedResponse} = await import('../../responses')

      const validResponse = {id: '123', name: 'Test'}
      const result = buildValidatedResponse(mockContext, 201, validResponse, testResponseSchema)

      expect(result.statusCode).toBe(201)
    })
  })
})
