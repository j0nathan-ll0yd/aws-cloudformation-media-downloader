import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'

describe('Lambda:Middleware:API', () => {
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

  describe('wrapApiHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    it('should return handler result on success', async () => {
      const {wrapApiHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapApiHandler<TestEvent>(async ({context}) => buildValidatedResponse(context, 200, {success: true}))

      const result = await handler({httpMethod: 'GET'}, mockContext)

      expect(result.statusCode).toBe(200)
    })

    it('should return 500 error response when handler throws', async () => {
      const {wrapApiHandler} = await import('../../middleware/api')
      const handler = wrapApiHandler<TestEvent>(async () => {
        throw new Error('Test error')
      })

      const result = await handler({}, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Test error')
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapApiHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapApiHandler<TestEvent>(async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      await handler({}, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should use provided metadata traceId and correlationId when available', async () => {
      const {wrapApiHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      let receivedMetadata: {traceId: string; correlationId: string} | undefined
      const handler = wrapApiHandler<TestEvent>(async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      await handler({}, mockContext, {traceId: 'custom-trace-id', correlationId: 'custom-correlation-id'})

      expect(receivedMetadata?.traceId).toBe('custom-trace-id')
      expect(receivedMetadata?.correlationId).toBe('custom-correlation-id')
    })

    it('should log fixtures for incoming event and outgoing result', async () => {
      const {wrapApiHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapApiHandler<TestEvent>(async ({context}) => buildValidatedResponse(context, 200, {data: 'test'}))

      await handler({testField: 'value'}, mockContext)

      // Should have at least 2 fixture logs via Powertools logger (incoming and outgoing)
      const fixtureLogs = loggerInfoSpy.mock.calls.filter((call) => {
        const message = call[0] as string
        return message === 'fixture:incoming' || message === 'fixture:outgoing'
      })
      expect(fixtureLogs.length).toBe(2)
    })
  })

  describe('wrapAuthenticatedHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    // Event with valid Authorization header and userId from authorizer
    const authenticatedEvent: TestEvent = {
      httpMethod: 'GET',
      headers: {Authorization: 'Bearer valid-token'},
      requestContext: {authorizer: {principalId: 'user-123'}}
    }

    // Event with Authorization header but no valid userId (Unauthenticated)
    const unauthenticatedEvent: TestEvent = {
      httpMethod: 'GET',
      headers: {Authorization: 'Bearer invalid-token'},
      requestContext: {authorizer: {principalId: 'unknown'}}
    }

    // Event with no Authorization header (Anonymous)
    const anonymousEvent: TestEvent = {httpMethod: 'GET', headers: {}, requestContext: {authorizer: {principalId: 'unknown'}}}

    it('should return handler result for authenticated user', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapAuthenticatedHandler<TestEvent>(async ({context, userId}) => buildValidatedResponse(context, 200, {userId}))

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body.userId).toBe('user-123')
    })

    it('should provide guaranteed userId to handler', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      let receivedUserId: string | undefined
      const handler = wrapAuthenticatedHandler<TestEvent>(async ({context, userId}) => {
        receivedUserId = userId
        return buildValidatedResponse(context, 200, {})
      })

      await handler(authenticatedEvent, mockContext)

      expect(receivedUserId).toBe('user-123')
      expect(typeof receivedUserId).toBe('string')
    })

    it('should return 401 for unauthenticated user (invalid token)', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapAuthenticatedHandler<TestEvent>(async ({context}) => buildValidatedResponse(context, 200, {}))

      const result = await handler(unauthenticatedEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should return 401 for anonymous user (no token)', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapAuthenticatedHandler<TestEvent>(async ({context}) => buildValidatedResponse(context, 200, {}))

      const result = await handler(anonymousEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapAuthenticatedHandler<TestEvent>(async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      await handler(authenticatedEvent, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should return 500 when handler throws', async () => {
      const {wrapAuthenticatedHandler} = await import('../../middleware/api')
      const handler = wrapAuthenticatedHandler<TestEvent>(async () => {
        throw new Error('Internal error')
      })

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Internal error')
    })
  })

  describe('wrapOptionalAuthHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    // Event with valid Authorization header and userId from authorizer
    const authenticatedEvent: TestEvent = {
      httpMethod: 'GET',
      headers: {Authorization: 'Bearer valid-token'},
      requestContext: {authorizer: {principalId: 'user-123'}}
    }

    // Event with Authorization header but no valid userId (Unauthenticated)
    const unauthenticatedEvent: TestEvent = {
      httpMethod: 'GET',
      headers: {Authorization: 'Bearer invalid-token'},
      requestContext: {authorizer: {principalId: 'unknown'}}
    }

    // Event with no Authorization header (Anonymous)
    const anonymousEvent: TestEvent = {httpMethod: 'GET', headers: {}, requestContext: {authorizer: {principalId: 'unknown'}}}

    it('should return handler result for authenticated user', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context, userId}) => buildValidatedResponse(context, 200, {userId}))

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body.userId).toBe('user-123')
    })

    it('should return handler result for anonymous user', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const {UserStatus} = await import('#types/enums')
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context, userStatus}) => {
        if (userStatus === UserStatus.Anonymous) {
          return buildValidatedResponse(context, 200, {demo: true})
        }
        return buildValidatedResponse(context, 200, {demo: false})
      })

      const result = await handler(anonymousEvent, mockContext)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body.demo).toBe(true)
    })

    it('should return 401 for unauthenticated user (invalid token)', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context}) => buildValidatedResponse(context, 200, {}))

      const result = await handler(unauthenticatedEvent, mockContext)

      expect(result.statusCode).toBe(401)
    })

    it('should provide userId and userStatus to handler', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const {UserStatus} = await import('#types/enums')
      let receivedUserId: string | undefined
      let receivedUserStatus: typeof UserStatus[keyof typeof UserStatus] | undefined
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context, userId, userStatus}) => {
        receivedUserId = userId
        receivedUserStatus = userStatus
        return buildValidatedResponse(context, 200, {})
      })

      await handler(authenticatedEvent, mockContext)

      expect(receivedUserId).toBe('user-123')
      expect(receivedUserStatus).toBe(UserStatus.Authenticated)
    })

    it('should provide undefined userId for anonymous user', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      const {UserStatus} = await import('#types/enums')
      let receivedUserId: string | undefined
      let receivedUserStatus: typeof UserStatus[keyof typeof UserStatus] | undefined
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context, userId, userStatus}) => {
        receivedUserId = userId
        receivedUserStatus = userStatus
        return buildValidatedResponse(context, 200, {})
      })

      await handler(anonymousEvent, mockContext)

      expect(receivedUserId).toBeUndefined()
      expect(receivedUserStatus).toBe(UserStatus.Anonymous)
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const {buildValidatedResponse} = await import('../../responses')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapOptionalAuthHandler<TestEvent>(async ({context, metadata}) => {
        receivedMetadata = metadata
        return buildValidatedResponse(context, 200, {})
      })

      await handler(authenticatedEvent, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should return 500 when handler throws', async () => {
      const {wrapOptionalAuthHandler} = await import('../../middleware/api')
      const handler = wrapOptionalAuthHandler<TestEvent>(async () => {
        throw new Error('Internal error')
      })

      const result = await handler(authenticatedEvent, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Internal error')
    })
  })
})
