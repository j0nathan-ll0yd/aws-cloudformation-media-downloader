import {beforeEach, describe, expect, test, vi} from 'vitest'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'

// Mock the Powertools logger
const mockLogInfo = vi.fn()
const mockLogDebug = vi.fn()
const mockLogError = vi.fn()

vi.mock('#lib/vendor/Powertools', () => ({logger: {info: mockLogInfo, debug: mockLogDebug, error: mockLogError}}))

// Mock sanitizeData to verify it's called correctly
const mockSanitizeData = vi.fn((data: unknown) => ({...data as object, sanitized: true}))
vi.mock('#util/security', () => ({sanitizeData: mockSanitizeData}))

const {logInfo, logDebug, logError, getRequestSummary} = await import('./../logging')

describe('Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      const event = createAPIGatewayEvent({path: '/api/files', httpMethod: 'GET'})

      const result = getRequestSummary(event)

      expect(result).toEqual({
        path: '/api/files',
        method: 'GET',
        requestId: event.requestContext.requestId,
        sourceIp: event.requestContext.identity.sourceIp
      })
    })

    // Edge case tests use partial objects to verify fallback behavior
    // These intentionally don't use factories to test graceful handling of incomplete data

    test('should fallback to resource when path is not available', () => {
      const event = {resource: '/api/users/{userId}', httpMethod: 'DELETE', requestContext: {requestId: 'req-456'}}

      const result = getRequestSummary(event)

      expect(result).toEqual({path: '/api/users/{userId}', method: 'DELETE', requestId: 'req-456', sourceIp: undefined})
    })

    test('should handle missing requestContext gracefully', () => {
      const event = {path: '/api/files', httpMethod: 'POST'}

      const result = getRequestSummary(event)

      expect(result).toEqual({path: '/api/files', method: 'POST', requestId: undefined, sourceIp: undefined})
    })

    test('should handle empty event object', () => {
      const result = getRequestSummary({})

      expect(result).toEqual({path: undefined, method: undefined, requestId: undefined, sourceIp: undefined})
    })
  })
})
