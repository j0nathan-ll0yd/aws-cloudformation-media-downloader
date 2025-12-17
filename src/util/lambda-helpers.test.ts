import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import type {APIGatewayRequestAuthorizerEvent, Context, CustomAuthorizerResult, S3Event, ScheduledEvent, SQSEvent} from 'aws-lambda'

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
      expect(loggedData.data.body.user.email).toBe('[REDACTED]')
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

  describe('wrapApiHandler', () => {
    const mockContext = {awsRequestId: 'test-request-id'} as Context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TestEvent = any

    it('should return handler result on success', async () => {
      const {wrapApiHandler, response} = await import('./lambda-helpers')
      const handler = wrapApiHandler<TestEvent>(async (_event, context) => response(context, 200, {success: true}))

      const result = await handler({httpMethod: 'GET'}, mockContext)

      expect(result.statusCode).toBe(200)
    })

    it('should return 500 error response when handler throws', async () => {
      const {wrapApiHandler} = await import('./lambda-helpers')
      const handler = wrapApiHandler<TestEvent>(async () => {
        throw new Error('Test error')
      })

      const result = await handler({}, mockContext)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error.message).toBe('Test error')
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapApiHandler, response} = await import('./lambda-helpers')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapApiHandler<TestEvent>(async (_event, context, metadata) => {
        receivedMetadata = metadata
        return response(context, 200, {})
      })

      await handler({}, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should use provided metadata traceId when available', async () => {
      const {wrapApiHandler, response} = await import('./lambda-helpers')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapApiHandler<TestEvent>(async (_event, context, metadata) => {
        receivedMetadata = metadata
        return response(context, 200, {})
      })

      await handler({}, mockContext, {traceId: 'custom-trace-id'})

      expect(receivedMetadata?.traceId).toBe('custom-trace-id')
    })

    it('should log fixtures for incoming event and outgoing result', async () => {
      const {wrapApiHandler, response} = await import('./lambda-helpers')
      const handler = wrapApiHandler<TestEvent>(async (_event, context) => response(context, 200, {data: 'test'}))

      await handler({testField: 'value'}, mockContext)

      // Should have at least 2 fixture logs (incoming and outgoing)
      const fixtureLogs = consoleLogSpy.mock.calls.filter((call) => {
        try {
          const logData = JSON.parse(call[0] as string)
          return logData.__FIXTURE_MARKER__
        } catch {
          return false // Skip non-JSON logs
        }
      })
      expect(fixtureLogs.length).toBe(2)
    })
  })

  describe('wrapAuthorizer', () => {
    const mockContext = {awsRequestId: 'auth-request-id'} as Context
    const mockEvent = {
      methodArn: 'arn:aws:execute-api:us-east-1:123456789:api/GET/resource',
      requestContext: {identity: {sourceIp: '127.0.0.1'}}
    } as APIGatewayRequestAuthorizerEvent

    it('should return policy result on success', async () => {
      const {wrapAuthorizer} = await import('./lambda-helpers')
      const mockPolicy: CustomAuthorizerResult = {
        principalId: 'user123',
        policyDocument: {Version: '2012-10-17', Statement: [{Effect: 'Allow', Action: 'execute-api:Invoke', Resource: '*'}]}
      }
      const handler = wrapAuthorizer(async () => mockPolicy)

      const result = await handler(mockEvent, mockContext)

      expect(result.principalId).toBe('user123')
    })

    it('should propagate Unauthorized error for 401', async () => {
      const {wrapAuthorizer} = await import('./lambda-helpers')
      const handler = wrapAuthorizer(async () => {
        throw new Error('Unauthorized')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Unauthorized')
    })

    it('should rethrow other errors after logging', async () => {
      const {wrapAuthorizer} = await import('./lambda-helpers')
      const handler = wrapAuthorizer(async () => {
        throw new Error('Database connection failed')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Database connection failed')
    })
  })

  describe('wrapEventHandler', () => {
    const mockContext = {awsRequestId: 'event-request-id'} as Context

    it('should process all records successfully', async () => {
      const {wrapEventHandler} = await import('./lambda-helpers')
      const processedRecords: string[] = []
      const handler = wrapEventHandler(
        async (record: {id: string}) => {
          processedRecords.push(record.id)
        },
        {getRecords: (event: {records: {id: string}[]}) => event.records}
      )

      await handler({records: [{id: '1'}, {id: '2'}, {id: '3'}]}, mockContext)

      expect(processedRecords).toEqual(['1', '2', '3'])
    })

    it('should continue processing even when some records fail', async () => {
      const {wrapEventHandler} = await import('./lambda-helpers')
      const processedRecords: string[] = []
      const handler = wrapEventHandler(
        async (record: {id: string; shouldFail?: boolean}) => {
          if (record.shouldFail) {
            throw new Error(`Record ${record.id} failed`)
          }
          processedRecords.push(record.id)
        },
        {getRecords: (event: {records: {id: string; shouldFail?: boolean}[]}) => event.records}
      )

      await handler({records: [{id: '1'}, {id: '2', shouldFail: true}, {id: '3'}]}, mockContext)

      // Should process records 1 and 3, skip 2
      expect(processedRecords).toEqual(['1', '3'])
    })
  })

  describe('wrapScheduledHandler', () => {
    const mockContext = {awsRequestId: 'scheduled-request-id'} as Context
    const mockEvent = {
      version: '0',
      id: 'test-event-id',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789',
      time: '2024-01-01T00:00:00Z',
      region: 'us-east-1',
      resources: [],
      detail: {}
    } as ScheduledEvent

    it('should return result on success', async () => {
      const {wrapScheduledHandler} = await import('./lambda-helpers')
      const handler = wrapScheduledHandler(async () => ({pruned: 5}))

      const result = await handler(mockEvent, mockContext)

      expect(result).toEqual({pruned: 5})
    })

    it('should rethrow errors after logging', async () => {
      const {wrapScheduledHandler} = await import('./lambda-helpers')
      const handler = wrapScheduledHandler(async () => {
        throw new Error('Scheduled task failed')
      })

      await expect(handler(mockEvent, mockContext)).rejects.toThrow('Scheduled task failed')
    })

    it('should pass metadata with traceId to handler', async () => {
      const {wrapScheduledHandler} = await import('./lambda-helpers')
      let receivedMetadata: {traceId: string} | undefined
      const handler = wrapScheduledHandler(async (_event, _context, metadata) => {
        receivedMetadata = metadata
      })

      await handler(mockEvent, mockContext)

      expect(receivedMetadata?.traceId).toBe('scheduled-request-id')
    })
  })

  describe('s3Records', () => {
    it('should extract records from S3Event', async () => {
      const {s3Records} = await import('./lambda-helpers')
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
      const {sqsRecords} = await import('./lambda-helpers')
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
