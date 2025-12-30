/**
 * Unit tests for Correlation ID Extraction
 *
 * Tests extraction and propagation of correlation IDs across different event sources.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {APIGatewayProxyEvent, Context, S3Event, SQSEvent} from 'aws-lambda'
import {extractCorrelationId} from '../correlation'

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
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({_correlationId: 'corr-from-body'}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        expect(result.correlationId).toBe('corr-from-body')
      })

      it('should extract correlationId from SQS message body correlationId', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({correlationId: 'corr-from-correlationId'}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-correlationId')
      })

      it('should extract correlationId from SQS message body detail._correlationId', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({detail: {_correlationId: 'corr-from-detail-underscore'}}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-detail-underscore')
      })

      it('should extract correlationId from SQS message body detail.correlationId', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({detail: {correlationId: 'corr-from-detail'}}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('corr-from-detail')
      })

      it('should generate UUID when SQS body parsing fails', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: 'not-valid-json',
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.traceId).toBe('trace-id-123')
        // Should be a UUID format
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should generate UUID when SQS body has no correlationId', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({otherField: 'value'}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        // Should generate a new UUID
        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should prefer _correlationId over correlationId in SQS body', () => {
        const sqsEvent: SQSEvent = {
          Records: [{
            messageId: 'msg-123',
            receiptHandle: 'receipt',
            body: JSON.stringify({_correlationId: 'underscore-first', correlationId: 'second'}),
            attributes: {} as SQSEvent['Records'][0]['attributes'],
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }]
        }

        const result = extractCorrelationId(sqsEvent, mockContext)

        expect(result.correlationId).toBe('underscore-first')
      })
    })

    describe('API Gateway Events', () => {
      it('should extract correlationId from X-Correlation-ID header', () => {
        const apiEvent: APIGatewayProxyEvent = {
          body: null,
          headers: {'X-Correlation-ID': 'api-corr-123'},
          multiValueHeaders: {},
          httpMethod: 'GET',
          isBase64Encoded: false,
          path: '/test',
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '/test'
        }

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-123')
      })

      it('should extract correlationId from lowercase x-correlation-id header', () => {
        const apiEvent: APIGatewayProxyEvent = {
          body: null,
          headers: {'x-correlation-id': 'api-corr-lowercase'},
          multiValueHeaders: {},
          httpMethod: 'GET',
          isBase64Encoded: false,
          path: '/test',
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '/test'
        }

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-lowercase')
      })

      it('should extract correlationId from X-Correlation-Id header (mixed case)', () => {
        const apiEvent: APIGatewayProxyEvent = {
          body: null,
          headers: {'X-Correlation-Id': 'api-corr-mixed'},
          multiValueHeaders: {},
          httpMethod: 'GET',
          isBase64Encoded: false,
          path: '/test',
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '/test'
        }

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toBe('api-corr-mixed')
      })

      it('should generate UUID when API Gateway has no correlation header', () => {
        const apiEvent: APIGatewayProxyEvent = {
          body: null,
          headers: {},
          multiValueHeaders: {},
          httpMethod: 'GET',
          isBase64Encoded: false,
          path: '/test',
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '/test'
        }

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })

      it('should handle null headers in API Gateway event', () => {
        const apiEvent = {
          body: null,
          headers: null,
          multiValueHeaders: {},
          httpMethod: 'GET',
          isBase64Encoded: false,
          path: '/test',
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as APIGatewayProxyEvent['requestContext'],
          resource: '/test'
        } as unknown as APIGatewayProxyEvent

        const result = extractCorrelationId(apiEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('EventBridge Events', () => {
      it('should extract correlationId from EventBridge detail._correlationId', () => {
        const ebEvent = {detail: {_correlationId: 'eb-corr-123', otherField: 'value'}}

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('eb-corr-123')
      })

      it('should extract correlationId from EventBridge detail.correlationId', () => {
        const ebEvent = {detail: {correlationId: 'eb-corr-no-underscore', otherField: 'value'}}

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('eb-corr-no-underscore')
      })

      it('should prefer _correlationId over correlationId in EventBridge', () => {
        const ebEvent = {detail: {_correlationId: 'preferred', correlationId: 'fallback'}}

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toBe('preferred')
      })

      it('should generate UUID when EventBridge detail has no correlationId', () => {
        const ebEvent = {detail: {otherField: 'value'}}

        const result = extractCorrelationId(ebEvent, mockContext)

        expect(result.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('S3 Events', () => {
      it('should generate UUID for S3 events', () => {
        const s3Event: S3Event = {
          Records: [{
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'us-east-1',
            eventTime: '2024-01-01T00:00:00.000Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: {principalId: 'EXAMPLE'},
            requestParameters: {sourceIPAddress: '127.0.0.1'},
            responseElements: {'x-amz-request-id': 's3-request-123', 'x-amz-id-2': 'id2'},
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'config-id',
              bucket: {name: 'bucket', ownerIdentity: {principalId: 'EXAMPLE'}, arn: 'arn:aws:s3:::bucket'},
              object: {key: 'test/file.txt', size: 100, eTag: 'etag', sequencer: 'seq'}
            }
          }]
        }

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
