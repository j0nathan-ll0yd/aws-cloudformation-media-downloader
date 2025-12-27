import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult, S3Event, SQSEvent} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'

describe('Lambda:Middleware:Legacy', () => {
  let loggerInfoSpy: MockInstance<typeof logger.info>
  let loggerErrorSpy: MockInstance<typeof logger.error>

  beforeEach(() => {
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
  })

  describe('wrapAuthorizer', () => {
    const mockContext = {awsRequestId: 'auth-request-id'} as Context
    const mockEvent = {
      methodArn: 'arn:aws:execute-api:us-east-1:123456789:api/GET/resource',
      requestContext: {identity: {sourceIp: '127.0.0.1'}}
    } as APIGatewayRequestAuthorizerEvent

    it('should return policy result on success', async () => {
      const {wrapAuthorizer} = await import('../../middleware/legacy')
      const mockPolicy: CustomAuthorizerResult = {
        principalId: 'user123',
        policyDocument: {Version: '2012-10-17', Statement: [{Effect: 'Allow', Action: 'execute-api:Invoke', Resource: '*'}]}
      }
      const handler = wrapAuthorizer(async () => mockPolicy)

      const result = await handler(mockEvent, mockContext)

      expect(result.principalId).toBe('user123')
    })

    it('should propagate Unauthorized error for 401', async () => {
      const {wrapAuthorizer} = await import('../../middleware/legacy')
      const handler = wrapAuthorizer(async () => {
        throw new Error('Unauthorized')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Unauthorized')
    })

    it('should rethrow other errors after logging', async () => {
      const {wrapAuthorizer} = await import('../../middleware/legacy')
      const handler = wrapAuthorizer(async () => {
        throw new Error('Database connection failed')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Database connection failed')
    })
  })

  describe('wrapEventHandler', () => {
    const mockContext = {awsRequestId: 'event-request-id'} as Context

    it('should process all records successfully', async () => {
      const {wrapEventHandler} = await import('../../middleware/legacy')
      const processedRecords: string[] = []
      const handler = wrapEventHandler(async ({record}: {record: {id: string}; context: Context; metadata: {traceId: string}}) => {
        processedRecords.push(record.id)
      }, {getRecords: (event: {records: {id: string}[]}) => event.records})

      await handler({records: [{id: '1'}, {id: '2'}, {id: '3'}]}, mockContext)

      expect(processedRecords).toEqual(['1', '2', '3'])
    })

    it('should continue processing even when some records fail', async () => {
      const {wrapEventHandler} = await import('../../middleware/legacy')
      const processedRecords: string[] = []
      type RecordType = {id: string; shouldFail?: boolean}
      const handler = wrapEventHandler(async ({record}: {record: RecordType; context: Context; metadata: {traceId: string}}) => {
        if (record.shouldFail) {
          throw new Error(`Record ${record.id} failed`)
        }
        processedRecords.push(record.id)
      }, {getRecords: (event: {records: RecordType[]}) => event.records})

      await handler({records: [{id: '1'}, {id: '2', shouldFail: true}, {id: '3'}]}, mockContext)

      // Should process records 1 and 3, skip 2
      expect(processedRecords).toEqual(['1', '3'])
    })
  })

  describe('s3Records', () => {
    it('should extract records from S3Event', async () => {
      const {s3Records} = await import('../../middleware/legacy')
      const mockS3Event = {
        Records: [
          {s3: {object: {key: 'file1.mp4'}}},
          {s3: {object: {key: 'file2.mp4'}}}
        ]
      } as unknown as S3Event

      const records = s3Records(mockS3Event)

      expect(records.length).toBe(2)
      expect(records[0].s3.object.key).toBe('file1.mp4')
    })
  })

  describe('sqsRecords', () => {
    it('should extract records from SQSEvent', async () => {
      const {sqsRecords} = await import('../../middleware/legacy')
      const mockSQSEvent = {
        Records: [
          {body: '{"message": "test1"}'},
          {body: '{"message": "test2"}'}
        ]
      } as unknown as SQSEvent

      const records = sqsRecords(mockSQSEvent)

      expect(records.length).toBe(2)
      expect(records[0].body).toBe('{"message": "test1"}')
    })
  })
})
