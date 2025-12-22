import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {logger} from '#lib/vendor/Powertools'

describe('logging', () => {
  let loggerDebugSpy: jest.SpiedFunction<typeof logger.debug>
  let loggerInfoSpy: jest.SpiedFunction<typeof logger.info>
  let loggerErrorSpy: jest.SpiedFunction<typeof logger.error>

  beforeEach(() => {
    loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => undefined)
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerDebugSpy.mockRestore()
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
  })

  describe('logDebug', () => {
    it('should log debug message without data', async () => {
      const {logDebug} = await import('../logging')

      logDebug('test message')

      expect(loggerDebugSpy).toHaveBeenCalledWith('test message')
    })

    it('should log debug message with string data', async () => {
      const {logDebug} = await import('../logging')

      logDebug('test message', 'string data')

      expect(loggerDebugSpy).toHaveBeenCalledWith('test message', {data: 'string data'})
    })

    it('should log debug message with sanitized object data', async () => {
      const {logDebug} = await import('../logging')
      const data = {
        email: 'user@example.com',
        token: 'secret123',
        safeField: 'visible'
      }

      logDebug('test message', data)

      expect(loggerDebugSpy).toHaveBeenCalledWith('test message', {
        data: {
          email: '[REDACTED]',
          token: '[REDACTED]',
          safeField: 'visible'
        }
      })
    })

    it('should sanitize nested objects in debug logs', async () => {
      const {logDebug} = await import('../logging')
      const data = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'secret123'
        },
        metadata: {
          timestamp: Date.now(),
          token: 'auth-token-123'
        }
      }

      logDebug('user data', data)

      const call = loggerDebugSpy.mock.calls[0]
      expect(call[0]).toBe('user data')
      const loggedData = call[1] as {data: {user: {name: string; email: string; password: string}; metadata: {timestamp: number; token: string}}}
      expect(loggedData.data.user.name).toBe('John Doe')
      expect(loggedData.data.user.email).toBe('[REDACTED]')
      expect(loggedData.data.user.password).toBe('[REDACTED]')
      expect(loggedData.data.metadata.timestamp).toBeDefined()
      expect(loggedData.data.metadata.token).toBe('[REDACTED]')
    })

    it('should sanitize arrays in debug logs', async () => {
      const {logDebug} = await import('../logging')
      const data = {
        users: [
          {id: '1', email: 'user1@example.com'},
          {id: '2', email: 'user2@example.com'}
        ]
      }

      logDebug('user list', data)

      const call = loggerDebugSpy.mock.calls[0]
      const loggedData = call[1] as {data: {users: Array<{id: string; email: string}>}}
      expect(loggedData.data.users[0].id).toBe('1')
      expect(loggedData.data.users[0].email).toBe('[REDACTED]')
      expect(loggedData.data.users[1].id).toBe('2')
      expect(loggedData.data.users[1].email).toBe('[REDACTED]')
    })

    it('should handle all PII patterns in debug logs', async () => {
      const {logDebug} = await import('../logging')
      const data = {
        authorization: 'Bearer token',
        deviceToken: 'device-123',
        password: 'pass123',
        apiKey: 'key123',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        ssn: '123-45-6789',
        safeData: 'not-sensitive'
      }

      logDebug('comprehensive PII test', data)

      const call = loggerDebugSpy.mock.calls[0]
      const loggedData = call[1] as {data: Record<string, string>}
      expect(loggedData.data.authorization).toBe('[REDACTED]')
      expect(loggedData.data.deviceToken).toBe('[REDACTED]')
      expect(loggedData.data.password).toBe('[REDACTED]')
      expect(loggedData.data.apiKey).toBe('[REDACTED]')
      expect(loggedData.data.email).toBe('[REDACTED]')
      expect(loggedData.data.phoneNumber).toBe('[REDACTED]')
      expect(loggedData.data.ssn).toBe('[REDACTED]')
      expect(loggedData.data.safeData).toBe('not-sensitive')
    })
  })

  describe('logInfo', () => {
    it('should log info message without data', async () => {
      const {logInfo} = await import('../logging')

      logInfo('test message')

      expect(loggerInfoSpy).toHaveBeenCalledWith('test message')
    })

    it('should log info message with string data', async () => {
      const {logInfo} = await import('../logging')

      logInfo('test message', 'string data')

      expect(loggerInfoSpy).toHaveBeenCalledWith('test message', {data: 'string data'})
    })

    it('should log info message with object data', async () => {
      const {logInfo} = await import('../logging')
      const data = {key: 'value'}

      logInfo('test message', data)

      expect(loggerInfoSpy).toHaveBeenCalledWith('test message', {data})
    })
  })

  describe('logError', () => {
    it('should log error message without data', async () => {
      const {logError} = await import('../logging')

      logError('test error')

      expect(loggerErrorSpy).toHaveBeenCalledWith('test error')
    })

    it('should log error message with Error object', async () => {
      const {logError} = await import('../logging')
      const error = new Error('test error')

      logError('error occurred', error)

      expect(loggerErrorSpy).toHaveBeenCalledWith('error occurred', error)
    })

    it('should log error message with string data', async () => {
      const {logError} = await import('../logging')

      logError('error occurred', 'error details')

      expect(loggerErrorSpy).toHaveBeenCalledWith('error occurred', {data: 'error details'})
    })

    it('should log error message with object data', async () => {
      const {logError} = await import('../logging')
      const data = {errorCode: 'E001'}

      logError('error occurred', data)

      expect(loggerErrorSpy).toHaveBeenCalledWith('error occurred', {data})
    })
  })
})
