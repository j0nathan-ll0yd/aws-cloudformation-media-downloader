import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import type {Context, SQSEvent, SQSRecord} from 'aws-lambda'
import {logger} from '#lib/vendor/Powertools'

describe('Lambda:Middleware:SQS', () => {
  let consoleLogSpy: MockInstance<typeof console.log>
  let loggerInfoSpy: MockInstance<typeof logger.info>
  let loggerErrorSpy: MockInstance<typeof logger.error>
  let originalLogLevel: string | undefined

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    originalLogLevel = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'INFO'
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    loggerInfoSpy.mockRestore()
    loggerErrorSpy.mockRestore()
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })

  const mockContext = {awsRequestId: 'test-request-id', functionName: 'TestHandler'} as Context

  type TestBody = {id: string; value: number}

  function createSQSRecord(messageId: string, body: object | string): SQSRecord {
    return {
      messageId,
      receiptHandle: `receipt-${messageId}`,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      attributes: {ApproximateReceiveCount: '1', SentTimestamp: '1234567890', SenderId: 'test-sender', ApproximateFirstReceiveTimestamp: '1234567890'},
      messageAttributes: {type: {stringValue: 'test', dataType: 'String'}},
      md5OfBody: 'abc123',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:test-queue',
      awsRegion: 'us-east-1'
    }
  }

  function createSQSEvent(records: SQSRecord[]): SQSEvent {
    return {Records: records}
  }

  describe('wrapSqsBatchHandler', () => {
    it('should return empty batchItemFailures when all records succeed', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const processedBodies: TestBody[] = []
      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        processedBodies.push(body)
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([])
      expect(processedBodies).toHaveLength(2)
      expect(processedBodies[0]).toEqual({id: '1', value: 100})
      expect(processedBodies[1]).toEqual({id: '2', value: 200})
    })

    it('should return failed message IDs when handler throws', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        if (body.id === '2') {
          throw new Error('Processing failed for message 2')
        }
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200}),
        createSQSRecord('msg-3', {id: '3', value: 300})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-2'}])
    })

    it('should return multiple failed message IDs when multiple handlers throw', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        if (body.id === '1' || body.id === '3') {
          throw new Error('Processing failed')
        }
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200}),
        createSQSRecord('msg-3', {id: '3', value: 300})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toHaveLength(2)
      expect(result.batchItemFailures).toContainEqual({itemIdentifier: 'msg-1'})
      expect(result.batchItemFailures).toContainEqual({itemIdentifier: 'msg-3'})
    })

    it('should continue processing after error by default', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const processedIds: string[] = []
      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        if (body.id === '1') {
          throw new Error('First message fails')
        }
        processedIds.push(body.id)
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200}),
        createSQSRecord('msg-3', {id: '3', value: 300})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-1'}])
      expect(processedIds).toEqual(['2', '3'])
    })

    it('should stop processing on first error when stopOnError is true', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const processedIds: string[] = []
      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        if (body.id === '2') {
          throw new Error('Second message fails')
        }
        processedIds.push(body.id)
      }, {stopOnError: true})

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200}),
        createSQSRecord('msg-3', {id: '3', value: 300})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-2'}])
      expect(processedIds).toEqual(['1']) // msg-3 was never processed
    })

    it('should handle JSON parse errors', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async () => {
        // Handler should not be called for invalid JSON
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', 'invalid json {'),
        createSQSRecord('msg-2', {id: '2', value: 200})
      ])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([{itemIdentifier: 'msg-1'}])
    })

    it('should skip JSON parsing when parseBody is false', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      let receivedBody: unknown
      const handler = wrapSqsBatchHandler<string>(async ({body}) => {
        receivedBody = body
      }, {parseBody: false})

      const rawBody = 'raw string body'
      const event = createSQSEvent([{...createSQSRecord('msg-1', ''), body: rawBody}])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([])
      expect(receivedBody).toBe(rawBody)
    })

    it('should provide messageAttributes to handler', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      let receivedAttributes: SQSRecord['messageAttributes'] | undefined
      const handler = wrapSqsBatchHandler<TestBody>(async ({messageAttributes}) => {
        receivedAttributes = messageAttributes
      })

      const event = createSQSEvent([createSQSRecord('msg-1', {id: '1', value: 100})])

      await handler(event, mockContext)

      expect(receivedAttributes?.type?.stringValue).toBe('test')
    })

    it('should provide metadata with traceId to handler', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      let receivedMetadata: {traceId: string; correlationId: string} | undefined
      const handler = wrapSqsBatchHandler<TestBody>(async ({metadata}) => {
        receivedMetadata = metadata
      })

      const event = createSQSEvent([createSQSRecord('msg-1', {id: '1', value: 100})])

      await handler(event, mockContext)

      expect(receivedMetadata?.traceId).toBe('test-request-id')
    })

    it('should use provided metadata when available', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      let receivedMetadata: {traceId: string; correlationId: string} | undefined
      const handler = wrapSqsBatchHandler<TestBody>(async ({metadata}) => {
        receivedMetadata = metadata
      })

      const event = createSQSEvent([createSQSRecord('msg-1', {id: '1', value: 100})])

      await handler(event, mockContext, {traceId: 'custom-trace', correlationId: 'custom-correlation'})

      expect(receivedMetadata?.traceId).toBe('custom-trace')
      expect(receivedMetadata?.correlationId).toBe('custom-correlation')
    })

    it('should handle empty event', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async () => {
        throw new Error('Should not be called')
      })

      const event = createSQSEvent([])

      const result = await handler(event, mockContext)

      expect(result.batchItemFailures).toEqual([])
    })

    it('should log batch statistics', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async ({body}) => {
        if (body.id === '2') {
          throw new Error('Failed')
        }
      })

      const event = createSQSEvent([
        createSQSRecord('msg-1', {id: '1', value: 100}),
        createSQSRecord('msg-2', {id: '2', value: 200}),
        createSQSRecord('msg-3', {id: '3', value: 300})
      ])

      await handler(event, mockContext)

      const infoLogs = loggerInfoSpy.mock.calls.filter((call) => {
        const message = call[0] as string
        return message.includes('SQS batch processing')
      })
      expect(infoLogs.length).toBeGreaterThanOrEqual(1)
    })

    it('should log incoming fixture', async () => {
      const {wrapSqsBatchHandler} = await import('../../middleware/sqs')

      const handler = wrapSqsBatchHandler<TestBody>(async () => {})

      const event = createSQSEvent([createSQSRecord('msg-1', {id: '1', value: 100})])

      await handler(event, mockContext)

      const fixtureLogs = loggerInfoSpy.mock.calls.filter((call) => {
        const message = call[0] as string
        return message === 'fixture:incoming'
      })
      expect(fixtureLogs.length).toBe(1)
    })
  })
})
