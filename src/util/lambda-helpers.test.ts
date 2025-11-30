import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

describe('lambda-helpers', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    originalEnv = process.env
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    process.env = originalEnv
  })

  describe('logIncomingFixture', () => {
    it('should log incoming fixture with manual type', async () => {
      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST', body: '{"test":"data"}', headers: {Authorization: 'Bearer token123'}}

      logIncomingFixture(mockEvent, 'test-fixture')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.__FIXTURE_MARKER__).toBe('INCOMING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect(loggedData.data.headers.Authorization).toBe('[REDACTED]')
      expect(loggedData.data.httpMethod).toBe('POST')
      expect(loggedData.timestamp).toBeDefined()
    })

    it('should auto-detect Lambda name from AWS_LAMBDA_FUNCTION_NAME', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'ListFiles'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('ListFiles')
    })

    it('should use manual override when provided', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'ListFiles'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent, 'CustomName')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('CustomName')
    })

    it('should fallback to UnknownLambda when no name available', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('UnknownLambda')
    })
  })

  describe('logOutgoingFixture', () => {
    it('should log outgoing fixture with manual type', async () => {
      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {statusCode: 200, body: JSON.stringify({success: true}), headers: {'Content-Type': 'application/json'}}

      logOutgoingFixture(mockResponse, 'test-fixture')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.__FIXTURE_MARKER__).toBe('OUTGOING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect(loggedData.data.statusCode).toBe(200)
      expect(loggedData.timestamp).toBeDefined()
    })

    it('should auto-detect Lambda name from AWS_LAMBDA_FUNCTION_NAME', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'

      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('WebhookFeedly')
    })

    it('should use manual override when provided', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'

      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse, 'CustomName')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('CustomName')
    })

    it('should fallback to UnknownLambda when no name available', async () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.fixtureType).toBe('UnknownLambda')
    })
  })

  describe('sanitization', () => {
    it('should redact sensitive fields', async () => {
      const {logIncomingFixture} = await import('./lambda-helpers')
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

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.data.authorization).toBe('[REDACTED]')
      expect(loggedData.data.Authorization).toBe('[REDACTED]')
      expect(loggedData.data.token).toBe('[REDACTED]')
      expect(loggedData.data.password).toBe('[REDACTED]')
      expect(loggedData.data.apiKey).toBe('[REDACTED]')
      expect(loggedData.data.secret).toBe('[REDACTED]')
      expect(loggedData.data.appleDeviceIdentifier).toBe('[REDACTED]')
      expect(loggedData.data.safeField).toBe('visible')
    })

    it('should handle nested objects', async () => {
      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {
        headers: {Authorization: 'Bearer secret', 'Content-Type': 'application/json'},
        body: {user: {password: 'secret123', email: 'test@example.com'}}
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.data.headers.Authorization).toBe('[REDACTED]')
      expect(loggedData.data.headers['Content-Type']).toBe('application/json')
      expect(loggedData.data.body.user.password).toBe('[REDACTED]')
      expect(loggedData.data.body.user.email).toBe('test@example.com')
    })

    it('should handle arrays', async () => {
      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {items: [{id: '1', token: 'secret1'}, {id: '2', token: 'secret2'}]}

      logIncomingFixture(mockEvent, 'test-fixture')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.data.items[0].id).toBe('1')
      expect(loggedData.data.items[0].token).toBe('[REDACTED]')
      expect(loggedData.data.items[1].id).toBe('2')
      expect(loggedData.data.items[1].token).toBe('[REDACTED]')
    })
  })
})
