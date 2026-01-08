/**
 * Unit tests for Correlation ID Extraction
 *
 * Tests extraction and propagation of correlation IDs across different event sources.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {Context, S3Event, SQSEvent} from 'aws-lambda'
import {extractCorrelationId} from '../correlation'
import {createAPIGatewayEvent, createS3Event, createScheduledEvent, createSQSEvent} from '#test/helpers/event-factories'

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'trace-id-123',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'stream-123',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn()
}

describe('Correlation ID Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractCorrelationId', () => {
    describe('SQS Events', () => {
      it('should extract correlationId from SQS message body _correlationId', () => {
        const sqsEvent = createSQSEvent({records: [{body: {_correlationId: 'corr-from-body'}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        expect(result.correlationId).toBe('corr-from-body')
      })

      it('should extract correlationId from SQS message body correlationId', () => {
        const sqsEvent = createSQSEvent({records: [{body: {correlationId: 'corr-from-correlationId'}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-correlationId')
      })

      it('should extract correlationId from SQS message body detail._correlationId', () => {
        const sqsEvent = createSQSEvent({records: [{body: {detail: {_correlationId: 'corr-from-detail-underscore'}}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-detail-underscore')
      })

      it('should extract correlationId from SQS message body detail.correlationId', () => {
        const sqsEvent = createSQSEvent({records: [{body: {detail: {correlationId: 'corr-from-detail'}}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-detail')
      })

      it('should generate UUID when SQS body parsing fails', () => {
        const sqsEvent = createSQSEvent({records: [{body: 'not-valid-json'}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        // Should be a UUID format
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should generate UUID when SQS body has no correlationId', () => {
        const sqsEvent = createSQSEvent({records: [{body: {otherField: 'value'}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        // Should generate a new UUID
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should prefer _correlationId over correlationId in SQS body', () => {
        const sqsEvent = createSQSEvent({records: [{body: {_correlationId: 'underscore-first', correlationId: 'second'}}]})

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('underscore-first')
      })
    })

    describe('API Gateway Events', () => {
      it('should extract correlationId from X-Correlation-ID header', () => {
        const apiEvent = createAPIGatewayEvent({path: '/test', headers: {'X-Correlation-ID': 'api-corr-123'}})

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-123')
      })

      it('should extract correlationId from lowercase x-correlation-id header', () => {
        const apiEvent = createAPIGatewayEvent({path: '/test', headers: {'x-correlation-id': 'api-corr-lowercase'}})

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-lowercase')
      })

      it('should extract correlationId from X-Correlation-Id header (mixed case)', () => {
        const apiEvent = createAPIGatewayEvent({path: '/test', headers: {'X-Correlation-Id': 'api-corr-mixed'}})

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-mixed')
      })

      it('should NOT use X-Amzn-Trace-Id as correlationId (different semantic purpose)', () => {
        // X-Amzn-Trace-Id is for X-Ray tracing (traceId), not business correlation (correlationId)
        const apiEvent = createAPIGatewayEvent({path: '/test', headers: {'X-Amzn-Trace-Id': 'Root=1-abc123-def456'}})

        const result = extractCorrelationId(apiEvent, mockContext)

        // Should generate UUID, NOT use X-Amzn-Trace-Id
        expect(result.correlationId).not.toBe('Root=1-abc123-def456')
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should generate UUID when API Gateway has no X-Correlation-ID header', () => {
        const apiEvent = createAPIGatewayEvent({path: '/test'})
        // Remove all headers to test the UUID fallback
        apiEvent.headers = {}

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should handle null headers in API Gateway event', () => {
        const apiEvent = createAPIGatewayEvent({path: '/test'}) // Test edge case: null headers (cast needed as factory always provides headers)
        ;(apiEvent as unknown as {headers: null}).headers = null

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('EventBridge Events', () => {
      it('should extract correlationId from EventBridge detail._correlationId', () => {
        const ebEvent = createScheduledEvent({detail: {_correlationId: 'eb-corr-123', otherField: 'value'}})

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('eb-corr-123')
      })

      it('should extract correlationId from EventBridge detail.correlationId', () => {
        const ebEvent = createScheduledEvent({detail: {correlationId: 'eb-corr-no-underscore', otherField: 'value'}})

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('eb-corr-no-underscore')
      })

      it('should prefer _correlationId over correlationId in EventBridge', () => {
        const ebEvent = createScheduledEvent({detail: {_correlationId: 'preferred', correlationId: 'fallback'}})

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('preferred')
      })

      it('should generate UUID when EventBridge detail has no correlationId', () => {
        const ebEvent = createScheduledEvent({detail: {otherField: 'value'}})

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('S3 Events', () => {
      it('should generate UUID for S3 events', () => {
        const s3Event = createS3Event({records: [{key: 'test/file.txt'}]})

        const result = extractCorrelationId(s3Event, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        // S3 events generate a new UUID since they don't carry correlation IDs
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('Unknown Events', () => {
      it('should generate UUID for unknown event types', () => {
        const unknownEvent = {someField: 'value'}

        const result = extractCorrelationId(unknownEvent, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should handle null event', () => {
        const result = extractCorrelationId(null, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should handle undefined event', () => {
        const result = extractCorrelationId(undefined, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('Event Type Detection Edge Cases', () => {
      it('should not treat empty Records array as SQS event', () => {
        const eventWithEmptyRecords: SQSEvent = {Records: []}

        const result = extractCorrelationId(eventWithEmptyRecords, mockContext)

        // Should generate UUID since empty Records doesn't qualify as SQS event
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should not treat empty Records array as S3 event', () => {
        const eventWithEmptyRecords: S3Event = {Records: []}

        const result = extractCorrelationId(eventWithEmptyRecords, mockContext)

        // Should generate UUID since empty Records doesn't qualify as S3 event
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should not treat non-array Records as SQS event', () => {
        const eventWithNonArrayRecords = {Records: 'not-an-array'}

        const result = extractCorrelationId(eventWithNonArrayRecords, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should not treat event with detail as EventBridge if detail is not object', () => {
        const eventWithNonObjectDetail = {detail: 'not-an-object'}

        const result = extractCorrelationId(eventWithNonObjectDetail, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('Priority Order', () => {
      it('should use traceId from context.awsRequestId', () => {
        const customContext: Context = {...mockContext, awsRequestId: 'custom-trace-id'}

        const result = extractCorrelationId({}, customContext)

        expect(result.traceId).toBe('custom-trace-id')
      })
    })
  })
})
