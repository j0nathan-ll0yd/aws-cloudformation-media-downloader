import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals'

describe('lambda-helpers', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    originalEnv = process.env
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    process.env = originalEnv
  })

  describe('logIncomingFixture', () => {
    it('should log fixture when ENABLE_FIXTURE_LOGGING is true', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'true'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {
        httpMethod: 'POST',
        body: '{"test":"data"}',
        headers: {Authorization: 'Bearer token123'}
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.__FIXTURE_MARKER__).toBe('INCOMING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect(loggedData.data.headers.Authorization).toBe('[REDACTED]')
      expect(loggedData.data.httpMethod).toBe('POST')
      expect(loggedData.timestamp).toBeDefined()
    })

    it('should not log when ENABLE_FIXTURE_LOGGING is false', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'false'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent, 'test-fixture')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should not log when ENABLE_FIXTURE_LOGGING is undefined', async () => {
      delete process.env.ENABLE_FIXTURE_LOGGING

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {httpMethod: 'POST'}

      logIncomingFixture(mockEvent, 'test-fixture')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('logOutgoingFixture', () => {
    it('should log fixture when ENABLE_FIXTURE_LOGGING is true', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'true'

      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {
        statusCode: 200,
        body: JSON.stringify({success: true}),
        headers: {'Content-Type': 'application/json'}
      }

      logOutgoingFixture(mockResponse, 'test-fixture')

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.__FIXTURE_MARKER__).toBe('OUTGOING')
      expect(loggedData.fixtureType).toBe('test-fixture')
      expect(loggedData.data.statusCode).toBe(200)
      expect(loggedData.timestamp).toBeDefined()
    })

    it('should not log when ENABLE_FIXTURE_LOGGING is false', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'false'

      const {logOutgoingFixture} = await import('./lambda-helpers')
      const mockResponse = {statusCode: 200}

      logOutgoingFixture(mockResponse, 'test-fixture')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('sanitization', () => {
    it('should redact sensitive fields', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'true'

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
      process.env.ENABLE_FIXTURE_LOGGING = 'true'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json'
        },
        body: {
          user: {
            password: 'secret123',
            email: 'test@example.com'
          }
        }
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.data.headers.Authorization).toBe('[REDACTED]')
      expect(loggedData.data.headers['Content-Type']).toBe('application/json')
      expect(loggedData.data.body.user.password).toBe('[REDACTED]')
      expect(loggedData.data.body.user.email).toBe('test@example.com')
    })

    it('should handle arrays', async () => {
      process.env.ENABLE_FIXTURE_LOGGING = 'true'

      const {logIncomingFixture} = await import('./lambda-helpers')
      const mockEvent = {
        items: [
          {id: '1', token: 'secret1'},
          {id: '2', token: 'secret2'}
        ]
      }

      logIncomingFixture(mockEvent, 'test-fixture')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
      expect(loggedData.data.items[0].id).toBe('1')
      expect(loggedData.data.items[0].token).toBe('[REDACTED]')
      expect(loggedData.data.items[1].id).toBe('2')
      expect(loggedData.data.items[1].token).toBe('[REDACTED]')
    })
  })
})
