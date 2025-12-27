import {describe, expect, jest, test, beforeEach} from '@jest/globals'

// Mock the Powertools logger
const mockLogInfo = jest.fn()
const mockLogDebug = jest.fn()
const mockLogError = jest.fn()

jest.unstable_mockModule('#lib/vendor/Powertools', () => ({
  logger: {
    info: mockLogInfo,
    debug: mockLogDebug,
    error: mockLogError
  }
}))

// Mock sanitizeData to verify it's called correctly
const mockSanitizeData = jest.fn((data: unknown) => ({...data as object, sanitized: true}))
jest.unstable_mockModule('#util/security', () => ({sanitizeData: mockSanitizeData}))

const {logInfo, logDebug, logError, getRequestSummary} = await import('./../logging')

describe('Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('logInfo', () => {
    test('should call logger.info with message only when no data provided', () => {
      logInfo('Test message')
      expect(mockLogInfo).toHaveBeenCalledWith('Test message')
      expect(mockLogInfo).toHaveBeenCalledTimes(1)
    })

    test('should wrap string data in object', () => {
      logInfo('Test message', 'string data')
      expect(mockLogInfo).toHaveBeenCalledWith('Test message', {data: 'string data'})
    })

    test('should sanitize object data before logging', () => {
      const data = {userId: 'user-123', password: 'secret'}
      logInfo('Test message', data)
      expect(mockSanitizeData).toHaveBeenCalledWith(data)
      expect(mockLogInfo).toHaveBeenCalledWith('Test message', {data: expect.objectContaining({sanitized: true})})
    })
  })

  describe('logDebug', () => {
    test('should call logger.debug with message only when no data provided', () => {
      logDebug('Debug message')
      expect(mockLogDebug).toHaveBeenCalledWith('Debug message')
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
    })

    test('should wrap string data in object', () => {
      logDebug('Debug message', 'debug string')
      expect(mockLogDebug).toHaveBeenCalledWith('Debug message', {data: 'debug string'})
    })

    test('should sanitize object data before logging', () => {
      const data = {deviceId: 'device-123', token: 'secret-token'}
      logDebug('Debug message', data)
      expect(mockSanitizeData).toHaveBeenCalledWith(data)
      expect(mockLogDebug).toHaveBeenCalledWith('Debug message', {data: expect.objectContaining({sanitized: true})})
    })
  })

  describe('logError', () => {
    test('should call logger.error with message only when no data provided', () => {
      logError('Error message')
      expect(mockLogError).toHaveBeenCalledWith('Error message')
      expect(mockLogError).toHaveBeenCalledTimes(1)
    })

    test('should pass Error instance directly to logger', () => {
      const error = new Error('Something went wrong')
      logError('Error occurred', error)
      expect(mockLogError).toHaveBeenCalledWith('Error occurred', error)
      expect(mockSanitizeData).not.toHaveBeenCalled()
    })

    test('should wrap string data in object', () => {
      logError('Error message', 'error details')
      expect(mockLogError).toHaveBeenCalledWith('Error message', {data: 'error details'})
    })

    test('should sanitize object data before logging', () => {
      const data = {userId: 'user-123', email: 'test@example.com', errorCode: 500}
      logError('Error message', data)
      expect(mockSanitizeData).toHaveBeenCalledWith(data)
      expect(mockLogError).toHaveBeenCalledWith('Error message', {data: expect.objectContaining({sanitized: true})})
    })
  })

  describe('getRequestSummary', () => {
    test('should extract path, method, requestId, and sourceIp from API Gateway event', () => {
      const event = {
        path: '/api/files',
        httpMethod: 'GET',
        requestContext: {
          requestId: 'req-123',
          identity: {sourceIp: '192.168.1.1'}
        }
      }

      const result = getRequestSummary(event)

      expect(result).toEqual({
        path: '/api/files',
        method: 'GET',
        requestId: 'req-123',
        sourceIp: '192.168.1.1'
      })
    })

    test('should fallback to resource when path is not available', () => {
      const event = {
        resource: '/api/users/{userId}',
        httpMethod: 'DELETE',
        requestContext: {requestId: 'req-456'}
      }

      const result = getRequestSummary(event)

      expect(result).toEqual({
        path: '/api/users/{userId}',
        method: 'DELETE',
        requestId: 'req-456',
        sourceIp: undefined
      })
    })

    test('should handle missing requestContext gracefully', () => {
      const event = {path: '/api/files', httpMethod: 'POST'}

      const result = getRequestSummary(event)

      expect(result).toEqual({
        path: '/api/files',
        method: 'POST',
        requestId: undefined,
        sourceIp: undefined
      })
    })

    test('should handle empty event object', () => {
      const result = getRequestSummary({})

      expect(result).toEqual({
        path: undefined,
        method: undefined,
        requestId: undefined,
        sourceIp: undefined
      })
    })
  })
})
