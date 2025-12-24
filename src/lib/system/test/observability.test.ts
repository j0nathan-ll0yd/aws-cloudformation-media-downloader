import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {logger} from '#lib/vendor/Powertools'

describe('System:Observability', () => {
  let loggerInfoSpy: jest.SpiedFunction<typeof logger.info>
  let loggerErrorSpy: jest.SpiedFunction<typeof logger.error>
  let originalLogLevel: string | undefined

  beforeEach(() => {
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
    originalLogLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'INFO' // Ensure fixtures are logged
  })

  afterEach(() => {
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })

  describe('logIncomingFixture', () => {
    it('should log incoming fixture with manual type', async () => {
      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {httpMethod: 'POST', body: '{"test":"data"}', headers: {Authorization: 'Bearer token123'}}

      logIncomingFixture(mockEvent, 'test-fixture')

      // First call is compact request summary, second is fixture
      expect(loggerInfoSpy).toHaveBeenCalledTimes(2)
      const fixtureCall = loggerInfoSpy.mock.calls[1]
      expect(fixtureCall[0]).toBe('fixture:incoming')
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.__FIXTURE_MARKER__).toBe('INCOMING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect((loggedData.event as Record<string, unknown>).headers).toEqual({Authorization: '[REDACTED]'})
      expect((loggedData.event as Record<string, unknown>).httpMethod).toBe('POST')
      expect(loggedData.capturedAt).toBeDefined()
    })

    it('should auto-detect Lambda name from AWS_LAMBDA_FUNCTION_NAME', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'ListFiles'

      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent)

      expect(loggerInfoSpy).toHaveBeenCalledTimes(2)
      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('ListFiles')
    })

    it('should use manual override when provided', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'ListFiles'

      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent, 'CustomName')

      expect(loggerInfoSpy).toHaveBeenCalledTimes(2)
      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('CustomName')
    })

    it('should fallback to UnknownLambda when no name available', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent)

      expect(loggerInfoSpy).toHaveBeenCalledTimes(2)
      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('UnknownLambda')
    })
  })

  describe('logOutgoingFixture', () => {
    it('should log outgoing fixture with manual type', async () => {
      const {logOutgoingFixture} = await import('../../system/observability')
      const mockResponse = {statusCode: 200, body: JSON.stringify({success: true}), headers: {'Content-Type': 'application/json'}}

      logOutgoingFixture(mockResponse, 'test-fixture')

      expect(loggerInfoSpy).toHaveBeenCalledTimes(1)
      const fixtureCall = loggerInfoSpy.mock.calls[0]
      expect(fixtureCall[0]).toBe('fixture:outgoing')
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.__FIXTURE_MARKER__).toBe('OUTGOING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect((loggedData.response as Record<string, unknown>).statusCode).toBe(200)
      expect(loggedData.capturedAt).toBeDefined()
    })

    it('should auto-detect Lambda name from AWS_LAMBDA_FUNCTION_NAME', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'

      const {logOutgoingFixture} = await import('../../system/observability')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse)

      expect(loggerInfoSpy).toHaveBeenCalledTimes(1)
      const fixtureCall = loggerInfoSpy.mock.calls[0]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('WebhookFeedly')
    })

    it('should use manual override when provided', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'

      const {logOutgoingFixture} = await import('../../system/observability')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse, 'CustomName')

      expect(loggerInfoSpy).toHaveBeenCalledTimes(1)
      const fixtureCall = loggerInfoSpy.mock.calls[0]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('CustomName')
    })

    it('should fallback to UnknownLambda when no name available', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const {logOutgoingFixture} = await import('../../system/observability')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse)

      expect(loggerInfoSpy).toHaveBeenCalledTimes(1)
      const fixtureCall = loggerInfoSpy.mock.calls[0]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      expect(loggedData.fixtureType).toBe('UnknownLambda')
    })
  })

  describe('sanitization', () => {
    it('should redact sensitive fields', async () => {
      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {
        authorization: 'Bearer secret',
        Authorization: 'Bearer secret2',
        token: 'abc123',
        password: 'mypass',
        apiKey: 'key123',
        secret: 'secretvalue',
        appleDeviceIdentifier: 'device123',
        safeField: 'visible'
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      const event = loggedData.event as Record<string, unknown>
      expect(event.authorization).toBe('[REDACTED]')
      expect(event.Authorization).toBe('[REDACTED]')
      expect(event.token).toBe('[REDACTED]')
      expect(event.password).toBe('[REDACTED]')
      expect(event.apiKey).toBe('[REDACTED]')
      expect(event.secret).toBe('[REDACTED]')
      expect(event.appleDeviceIdentifier).toBe('[REDACTED]')
      expect(event.safeField).toBe('visible')
    })

    it('should handle nested objects', async () => {
      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {
        headers: {Authorization: 'Bearer secret', 'Content-Type': 'application/json'},
        body: {user: {password: 'secret123', email: 'test@example.com'}}
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      const event = loggedData.event as Record<string, unknown>
      expect((event.headers as Record<string, unknown>).Authorization).toBe('[REDACTED]')
      expect((event.headers as Record<string, unknown>)['Content-Type']).toBe('application/json')
      expect(((event.body as Record<string, unknown>).user as Record<string, unknown>).password).toBe('[REDACTED]')
      expect(((event.body as Record<string, unknown>).user as Record<string, unknown>).email).toBe('[REDACTED]')
    })

    it('should handle arrays', async () => {
      const {logIncomingFixture} = await import('../../system/observability')
      const mockEvent = {items: [{id: '1', token: 'secret1'}, {id: '2', token: 'secret2'}]}

      logIncomingFixture(mockEvent, 'test-fixture')

      const fixtureCall = loggerInfoSpy.mock.calls[1]
      const loggedData = fixtureCall[1] as Record<string, unknown>
      const event = loggedData.event as Record<string, unknown>
      const items = event.items as Record<string, unknown>[]
      expect(items[0].id).toBe('1')
      expect(items[0].token).toBe('[REDACTED]')
      expect(items[1].id).toBe('2')
      expect(items[1].token).toBe('[REDACTED]')
    })
  })
})
