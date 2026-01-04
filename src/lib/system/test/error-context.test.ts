import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {Context} from 'aws-lambda'
import {CustomLambdaError, NotFoundError, ValidationError} from '#lib/system/errors'
import {buildErrorResponse} from '#lib/lambda/responses'
import type {ErrorContext} from '#types/errorContext'

// Mock the logging module to prevent actual logging during tests
vi.mock('#lib/system/logging', () => ({logError: vi.fn(), logDebug: vi.fn()}))

// Mock the validation module
vi.mock('#lib/lambda/middleware/apiGateway', () => ({validateResponse: vi.fn()}))

describe('CustomLambdaError context support', () => {
  it('should accept context in constructor', () => {
    const context: ErrorContext = {correlationId: 'corr-123', traceId: 'trace-456', timestamp: '2026-01-03T12:00:00Z'}

    const error = new CustomLambdaError('Test error', {context})

    expect(error.context).toEqual(context)
    expect(error.message).toBe('Test error')
  })

  it('should support withContext() method for fluent chaining', () => {
    const error = new CustomLambdaError('Test error')

    const context: ErrorContext = {correlationId: 'corr-123', traceId: 'trace-456', lambdaName: 'TestLambda', timestamp: '2026-01-03T12:00:00Z'}

    const result = error.withContext(context)

    expect(result).toBe(error) // Returns same instance for chaining
    expect(error.context).toEqual(context)
  })

  it('should merge context with withContext()', () => {
    const initialContext: ErrorContext = {correlationId: 'corr-123', timestamp: '2026-01-03T12:00:00Z'}

    const error = new CustomLambdaError('Test error', {context: initialContext})

    error.withContext({traceId: 'trace-456', lambdaName: 'TestLambda', timestamp: '2026-01-03T12:00:00Z'})

    expect(error.context?.correlationId).toBe('corr-123')
    expect(error.context?.traceId).toBe('trace-456')
    expect(error.context?.lambdaName).toBe('TestLambda')
  })

  it('should preserve cause when context is provided', () => {
    const cause = new Error('Original error')
    const context: ErrorContext = {correlationId: 'corr-123', timestamp: '2026-01-03T12:00:00Z'}

    const error = new CustomLambdaError('Wrapped error', {cause, context})

    expect(error.cause).toBe(cause)
    expect(error.context).toEqual(context)
  })
})

describe('Error subclasses inherit context support', () => {
  it('ValidationError supports withContext()', () => {
    const error = new ValidationError('Invalid input', {field: 'email'})

    error.withContext({correlationId: 'corr-123', timestamp: '2026-01-03T12:00:00Z'})

    expect(error.context?.correlationId).toBe('corr-123')
    expect(error.errors).toEqual({field: 'email'})
    expect(error.statusCode).toBe(400)
  })

  it('NotFoundError supports withContext()', () => {
    const error = new NotFoundError('Resource not found')

    error.withContext({userId: 'user-123', path: '/api/resource/123', timestamp: '2026-01-03T12:00:00Z'})

    expect(error.context?.userId).toBe('user-123')
    expect(error.context?.path).toBe('/api/resource/123')
    expect(error.statusCode).toBe(404)
  })
})

describe('buildErrorResponse context attachment', () => {
  const mockContext: Context = {
    awsRequestId: 'aws-req-123',
    functionName: 'TestLambda',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:TestLambda',
    memoryLimitInMB: '128',
    logGroupName: '/aws/lambda/TestLambda',
    logStreamName: '2026/01/03/[$LATEST]abc123',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 5000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should attach context to CustomLambdaError', () => {
    const error = new ValidationError('Invalid input')
    const metadata = {correlationId: 'corr-123', traceId: 'trace-456'}
    const requestInfo = {userId: 'user-123', path: '/api/test', httpMethod: 'POST'}

    buildErrorResponse(mockContext, error, metadata, requestInfo)

    expect(error.context?.correlationId).toBe('corr-123')
    expect(error.context?.traceId).toBe('trace-456')
    expect(error.context?.userId).toBe('user-123')
    expect(error.context?.path).toBe('/api/test')
    expect(error.context?.httpMethod).toBe('POST')
    expect(error.context?.lambdaName).toBe('TestLambda')
    expect(error.context?.timestamp).toBeDefined()
  })

  it('should use awsRequestId as fallback traceId', () => {
    const error = new NotFoundError('Not found')

    buildErrorResponse(mockContext, error)

    expect(error.context?.traceId).toBe('aws-req-123')
  })

  it('should return correct status code from CustomLambdaError', () => {
    const error = new NotFoundError('Resource not found')
    const metadata = {correlationId: 'corr-123', traceId: 'trace-456'}

    const response = buildErrorResponse(mockContext, error, metadata)

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toMatchObject({error: {code: 'NOT_FOUND', message: 'Resource not found'}, requestId: 'aws-req-123'})
  })

  it('should handle plain Error instances', () => {
    const error = new Error('Something went wrong')
    const metadata = {correlationId: 'corr-123', traceId: 'trace-456'}

    const response = buildErrorResponse(mockContext, error, metadata)

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toMatchObject({error: {message: 'Something went wrong'}, requestId: 'aws-req-123'})
  })

  it('should handle plain object errors', () => {
    const error = {status: 403, message: 'Forbidden'}
    const metadata = {correlationId: 'corr-123', traceId: 'trace-456'}

    const response = buildErrorResponse(mockContext, error, metadata)

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body)).toMatchObject({error: {message: 'Forbidden'}, requestId: 'aws-req-123'})
  })

  it('should handle unknown error types', () => {
    const error = 'Just a string error'
    const metadata = {correlationId: 'corr-123', traceId: 'trace-456'}

    const response = buildErrorResponse(mockContext, error, metadata)

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toMatchObject({error: {message: 'Just a string error'}, requestId: 'aws-req-123'})
  })
})
