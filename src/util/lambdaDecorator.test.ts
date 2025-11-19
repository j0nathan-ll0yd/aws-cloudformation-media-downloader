import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from './jest-setup'

const mockSegment = {
  trace_id: '1-67abc123-456def789ghi012jkl345mno',
  addError: jest.fn(),
  addAnnotation: jest.fn(),
  addMetadata: jest.fn(),
  close: jest.fn()
}

const getSegmentMock = jest.fn()
const captureAWSv3ClientMock = jest.fn()

jest.unstable_mockModule('aws-xray-sdk-core', () => ({
  default: {
    getSegment: getSegmentMock,
    captureAWSv3Client: captureAWSv3ClientMock
  }
}))

const {withXRay} = await import('./lambdaDecorator')

describe('#lambdaDecorator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSegmentMock.mockReturnValue(mockSegment)
    process.env.ENABLE_XRAY = 'true'
  })

  test('should pass trace ID to handler', async () => {
    const mockHandler = jest.fn<() => Promise<{statusCode: number}>>().mockResolvedValue({statusCode: 200})
    const wrappedHandler = withXRay(mockHandler)

    await wrappedHandler({test: 'event'}, testContext)

    expect(mockHandler).toHaveBeenCalledWith(
      {test: 'event'},
      testContext,
      {traceId: '1-67abc123-456def789ghi012jkl345mno'}
    )
  })

  test('should handle successful execution', async () => {
    const mockHandler = jest.fn<() => Promise<{statusCode: number; body: string}>>().mockResolvedValue({statusCode: 200, body: 'success'})
    const wrappedHandler = withXRay(mockHandler)

    const result = await wrappedHandler({test: 'event'}, testContext)

    expect(result).toEqual({statusCode: 200, body: 'success'})
    expect(getSegmentMock).toHaveBeenCalled()
  })

  test('should add error to segment on failure', async () => {
    const testError = new Error('Test error')
    const mockHandler = jest.fn<() => Promise<{statusCode: number}>>().mockRejectedValue(testError)
    const wrappedHandler = withXRay(mockHandler)

    await expect(wrappedHandler({test: 'event'}, testContext)).rejects.toThrow('Test error')

    expect(mockSegment.addError).toHaveBeenCalledWith(testError)
  })

  test('should work when ENABLE_XRAY is false', async () => {
    process.env.ENABLE_XRAY = 'false'
    const mockHandler = jest.fn<() => Promise<{statusCode: number}>>().mockResolvedValue({statusCode: 200})
    const wrappedHandler = withXRay(mockHandler)

    const result = await wrappedHandler({test: 'event'}, testContext)

    expect(result).toEqual({statusCode: 200})
    expect(mockHandler).toHaveBeenCalledWith({test: 'event'}, testContext, {})
    expect(getSegmentMock).not.toHaveBeenCalled()
  })

  test('should handle missing segment gracefully', async () => {
    getSegmentMock.mockReturnValue(undefined)
    const mockHandler = jest.fn<() => Promise<{statusCode: number}>>().mockResolvedValue({statusCode: 200})
    const wrappedHandler = withXRay(mockHandler)

    const result = await wrappedHandler({test: 'event'}, testContext)

    expect(result).toEqual({statusCode: 200})
    expect(mockHandler).toHaveBeenCalledWith({test: 'event'}, testContext, {traceId: undefined})
  })

  test('should not call addError when segment is undefined', async () => {
    getSegmentMock.mockReturnValue(undefined)
    const testError = new Error('Test error')
    const mockHandler = jest.fn<() => Promise<{statusCode: number}>>().mockRejectedValue(testError)
    const wrappedHandler = withXRay(mockHandler)

    await expect(wrappedHandler({test: 'event'}, testContext)).rejects.toThrow('Test error')

    expect(mockSegment.addError).not.toHaveBeenCalled()
  })
})
