/**
 * Unit tests for Legacy Lambda Wrappers
 *
 * Tests wrapAuthorizer and wrapEventHandler middleware patterns.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult, S3Event, S3EventRecord, SQSEvent} from 'aws-lambda'

// Mock dependencies BEFORE importing
vi.mock('#lib/system/logging', () => ({logDebug: vi.fn(), logError: vi.fn()}))

vi.mock('#lib/system/observability', () => ({logIncomingFixture: vi.fn()}))

vi.mock('#lib/lambda/correlation', () => ({extractCorrelationId: vi.fn(() => ({traceId: 'trace-123', correlationId: 'corr-123'}))}))

vi.mock('#lib/vendor/Powertools', () => ({logger: {appendKeys: vi.fn()}}))

// Import after mocking
const {wrapAuthorizer, wrapEventHandler, s3Records, sqsRecords} = await import('../legacy')
import {logDebug, logError} from '#lib/system/logging'
import {logIncomingFixture} from '#lib/system/observability'
import {logger} from '#lib/vendor/Powertools'

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'request-123',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'stream-123',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn()
}

describe('Legacy Lambda Wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('wrapAuthorizer', () => {
    const mockAuthEvent: APIGatewayRequestAuthorizerEvent = {
      type: 'REQUEST',
      methodArn: 'arn:aws:execute-api:region:account:api/stage/GET/resource',
      resource: '/resource',
      path: '/resource',
      httpMethod: 'GET',
      headers: {Authorization: 'Bearer token'},
      multiValueHeaders: {Authorization: ['Bearer token']},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        resourceId: 'resource-id',
        apiId: 'api-id',
        resourcePath: '/resource',
        httpMethod: 'GET',
        requestId: 'request-id',
        accountId: 'account-id',
        stage: 'prod',
        authorizer: undefined,
        identity: {
          apiKey: null,
          apiKeyId: null,
          accessKey: null,
          accountId: null,
          caller: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null,
          clientCert: null
        },
        path: '/resource',
        protocol: 'HTTP/1.1',
        requestTimeEpoch: Date.now()
      }
    }

    it('should wrap handler and return result on success', async () => {
      const policyResult: CustomAuthorizerResult = {
        principalId: 'user-123',
        policyDocument: {Version: '2012-10-17', Statement: [{Action: 'execute-api:Invoke', Effect: 'Allow', Resource: '*'}]}
      }
      const handler = vi.fn().mockResolvedValue(policyResult)

      const wrapped = wrapAuthorizer(handler)
      const result = await wrapped(mockAuthEvent, mockContext)

      expect(result).toEqual(policyResult)
      expect(handler).toHaveBeenCalledWith({event: mockAuthEvent, context: mockContext, metadata: {traceId: 'trace-123', correlationId: 'corr-123'}})
      expect(logger.appendKeys).toHaveBeenCalledWith({correlationId: 'corr-123', traceId: 'trace-123'})
      expect(logIncomingFixture).toHaveBeenCalledWith(mockAuthEvent)
      expect(logDebug).toHaveBeenCalledWith('response ==', policyResult)
    })

    it('should propagate Unauthorized error without logging', async () => {
      const unauthorizedError = new Error('Unauthorized')
      const handler = vi.fn().mockRejectedValue(unauthorizedError)

      const wrapped = wrapAuthorizer(handler)

      await expect(wrapped(mockAuthEvent, mockContext)).rejects.toThrow('Unauthorized')
      expect(logError).not.toHaveBeenCalled()
    })

    it('should log and rethrow unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed')
      const handler = vi.fn().mockRejectedValue(unexpectedError)

      const wrapped = wrapAuthorizer(handler)

      await expect(wrapped(mockAuthEvent, mockContext)).rejects.toThrow('Database connection failed')
      expect(logError).toHaveBeenCalledWith('authorizer error', unexpectedError)
    })

    it('should use provided metadata when available', async () => {
      const policyResult: CustomAuthorizerResult = {
        principalId: 'user-123',
        policyDocument: {Version: '2012-10-17', Statement: [{Action: 'execute-api:Invoke', Effect: 'Allow', Resource: '*'}]}
      }
      const handler = vi.fn().mockResolvedValue(policyResult)
      const metadata = {traceId: 'custom-trace', correlationId: 'custom-corr'}

      const wrapped = wrapAuthorizer(handler)
      await wrapped(mockAuthEvent, mockContext, metadata)

      expect(handler).toHaveBeenCalledWith({event: mockAuthEvent, context: mockContext, metadata})
      expect(logger.appendKeys).toHaveBeenCalledWith({correlationId: 'custom-corr', traceId: 'custom-trace'})
    })
  })

  describe('wrapEventHandler', () => {
    it('should process all records successfully', async () => {
      const mockRecords = [{id: '1'}, {id: '2'}]
      const handler = vi.fn().mockResolvedValue(undefined)
      const getRecords = vi.fn().mockReturnValue(mockRecords)

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext)

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith({record: {id: '1'}, context: mockContext, metadata: {traceId: 'trace-123', correlationId: 'corr-123'}})
    })

    it('should continue processing after individual record failure', async () => {
      const mockRecords = [{id: '1'}, {id: '2'}, {id: '3'}]
      const handler = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Record 2 failed')).mockResolvedValueOnce(undefined)
      const getRecords = vi.fn().mockReturnValue(mockRecords)

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext)

      expect(handler).toHaveBeenCalledTimes(3)
      expect(logError).toHaveBeenCalledWith('record processing error', {record: {id: '2'}, error: 'Record 2 failed'})
      expect(logError).toHaveBeenCalledWith('1/3 records failed', ['Record 2 failed'])
    })

    it('should handle non-Error thrown values', async () => {
      const mockRecords = [{id: '1'}]
      const handler = vi.fn().mockRejectedValue('string error')
      const getRecords = vi.fn().mockReturnValue(mockRecords)

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext)

      expect(logError).toHaveBeenCalledWith('record processing error', {record: {id: '1'}, error: 'string error'})
    })

    it('should not log errors when all records succeed', async () => {
      const mockRecords = [{id: '1'}, {id: '2'}]
      const handler = vi.fn().mockResolvedValue(undefined)
      const getRecords = vi.fn().mockReturnValue(mockRecords)

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext)

      // Only called with 'response ==' not with errors
      expect(logError).not.toHaveBeenCalled()
    })

    it('should report multiple failures correctly', async () => {
      const mockRecords = [{id: '1'}, {id: '2'}, {id: '3'}]
      const handler = vi.fn().mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2')).mockResolvedValueOnce(undefined)
      const getRecords = vi.fn().mockReturnValue(mockRecords)

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext)

      expect(logError).toHaveBeenCalledWith('2/3 records failed', ['Error 1', 'Error 2'])
    })

    it('should use provided metadata when available', async () => {
      const mockRecords = [{id: '1'}]
      const handler = vi.fn().mockResolvedValue(undefined)
      const getRecords = vi.fn().mockReturnValue(mockRecords)
      const metadata = {traceId: 'custom-trace', correlationId: 'custom-corr'}

      const wrapped = wrapEventHandler(handler, {getRecords})
      await wrapped({} as unknown, mockContext, metadata)

      expect(handler).toHaveBeenCalledWith({record: {id: '1'}, context: mockContext, metadata})
    })
  })

  describe('s3Records', () => {
    it('should extract Records from S3 event', () => {
      const mockS3Event: S3Event = {
        Records: [
          {eventName: 'ObjectCreated:Put'} as S3EventRecord,
          {eventName: 'ObjectCreated:Copy'} as S3EventRecord
        ]
      }

      const result = s3Records(mockS3Event)

      expect(result).toHaveLength(2)
      expect(result[0].eventName).toBe('ObjectCreated:Put')
    })
  })

  describe('sqsRecords', () => {
    it('should extract Records from SQS event', () => {
      const mockSQSEvent: SQSEvent = {
        Records: [
          {messageId: 'msg-1'} as unknown as SQSEvent['Records'][0],
          {messageId: 'msg-2'} as unknown as SQSEvent['Records'][0]
        ]
      }

      const result = sqsRecords(mockSQSEvent)

      expect(result).toHaveLength(2)
      expect(result[0].messageId).toBe('msg-1')
    })
  })
})
