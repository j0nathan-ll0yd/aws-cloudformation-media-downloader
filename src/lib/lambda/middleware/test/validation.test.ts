import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'
import {z} from 'zod'

describe('Lambda:Middleware:Validation', () => {
  let consoleLogSpy: MockInstance<typeof console.log>
  let loggerInfoSpy: MockInstance<typeof logger.info>
  let loggerErrorSpy: MockInstance<typeof logger.error>
  let originalLogLevel: string | undefined

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    originalLogLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'INFO'
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })

  // Test schema for validation
  const testSchema = z.object({name: z.string().min(1), email: z.string().email(), age: z.number().int().positive().optional()})

  type TestBody = z.infer<typeof testSchema>

  describe('wrapValidatedHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id', functionName: 'TestHandler'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    it('should pass validated body to handler on valid input', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      let receivedBody: TestBody | undefined
      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context, body}) => {
        receivedBody = body
        return buildValidatedResponse(context, 200, {success: true})
      })

      const event = {body: JSON.stringify({name: 'John', email: 'john@example.com', age: 30})}
      const result = await handler(event, mockContext)

      expect(result.statusCode).toBe(200)
      expect(receivedBody).toEqual({name: 'John', email: 'john@example.com', age: 30})
    })

    it('should return 400 with validation errors on invalid input', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {success: true})
      })

      const event = {body: JSON.stringify({name: '', email: 'invalid-email'})}
      const result = await handler(event, mockContext)

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBeDefined()
    })

    it('should return 400 on missing body', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {success: true})
      })

      const event = {}
      const result = await handler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })

    it('should return 400 on invalid JSON body', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {success: true})
      })

      const event = {body: 'not valid json {'}
      const result = await handler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      let receivedMetadata: {traceId: string; correlationId: string} | undefined
      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      const event = {body: JSON.stringify({name: 'John', email: 'john@example.com'})}
      await handler(event, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should use provided metadata when available', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      let receivedMetadata: {traceId: string; correlationId: string} | undefined
      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      const event = {body: JSON.stringify({name: 'John', email: 'john@example.com'})}
      await handler(event, mockContext, {traceId: 'custom-trace', correlationId: 'custom-correlation'})

      expect(receivedMetadata?.traceId).toBe('custom-trace')
      expect(receivedMetadata?.correlationId).toBe('custom-correlation')
    })

    it('should return 500 when handler throws', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')

      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async () => {
        throw new Error('Handler error')
      })

      const event = {body: JSON.stringify({name: 'John', email: 'john@example.com'})}
      const result = await handler(event, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Handler error')
    })

    it('should log fixtures for incoming event and outgoing result', async () => {
      const {wrapValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {data: 'test'})
      })

      const event = {body: JSON.stringify({name: 'John', email: 'john@example.com'})}
      await handler(event, mockContext)

      const fixtureLogs = loggerInfoSpy.mock.calls.filter((call) => {
        const message = call[0] as string
        return message === 'fixture:incoming' || message === 'fixture:outgoing'
      })
      expect(fixtureLogs.length).toBe(2)
    })
  })

  describe('wrapAuthenticatedValidatedHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id', functionName: 'TestHandler'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    // Event with valid Authorization header and userId from authorizer
    const authenticatedEvent: TestEvent = {
      httpMethod: 'POST',
      headers: {Authorization: 'Bearer valid-token'},
      requestContext: {authorizer: {principalId: 'user-123'}},
      body: JSON.stringify({name: 'John', email: 'john@example.com'})
    }

    // Event with no Authorization header (Anonymous)
    const anonymousEvent: TestEvent = {
      httpMethod: 'POST',
      headers: {},
      requestContext: {authorizer: {principalId: 'unknown'}},
      body: JSON.stringify({name: 'John', email: 'john@example.com'})
    }

    // Event with invalid token (Unauthenticated)
    const unauthenticatedEvent: TestEvent = {
      httpMethod: 'POST',
      headers: {Authorization: 'Bearer invalid-token'},
      requestContext: {authorizer: {principalId: 'unknown'}},
      body: JSON.stringify({name: 'John', email: 'john@example.com'})
    }

    it('should pass userId and validated body for authenticated user', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      let receivedUserId: string | undefined
      let receivedBody: TestBody | undefined
      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async ({context, userId, body}) => {
        receivedUserId = userId
        receivedBody = body
        return buildValidatedResponse(context, 200, {userId, data: body})
      })

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(200)
      expect(receivedUserId).toBe('user-123')
      expect(receivedBody).toEqual({name: 'John', email: 'john@example.com'})
    })

    it('should return 401 for anonymous user before validation', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {})
      })

      const result = await handler(anonymousEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should return 401 for unauthenticated user before validation', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {})
      })

      const result = await handler(unauthenticatedEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should return 400 for authenticated user with invalid body', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async ({context}) => {
        return buildValidatedResponse(context, 200, {})
      })

      const invalidBodyEvent = {...authenticatedEvent, body: JSON.stringify({name: '', email: 'invalid'})}
      const result = await handler(invalidBodyEvent, mockContext)

      expect(result.statusCode).toBe(400)
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')
      const {buildValidatedResponse} = await import('../../responses')

      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      await handler(authenticatedEvent, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should return 500 when handler throws', async () => {
      const {wrapAuthenticatedValidatedHandler} = await import('../../middleware/validation')

      const handler = wrapAuthenticatedValidatedHandler<TestBody, TestEvent>(testSchema, async () => {
        throw new Error('Handler error')
      })

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Handler error')
    })
  })
})
