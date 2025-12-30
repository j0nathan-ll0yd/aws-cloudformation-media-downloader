/**
 * Unit tests for Correlation ID Utilities
 *
 * Tests extraction and propagation of correlation IDs across different event sources.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {S3Event, S3EventRecord, SQSRecord} from 'aws-lambda'

// Mock dependencies
vi.mock('#lib/vendor/Powertools', () => ({logger: {appendKeys: vi.fn()}}))

// Import after mocking
const {
  extractCorrelationFromSQS,
  extractCorrelationFromS3,
  extractCorrelationFromS3Record,
  appendCorrelationToLogger,
  withCorrelation
} = await import('../correlation')
import {logger} from '#lib/vendor/Powertools'

describe('Correlation ID Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractCorrelationFromSQS', () => {
    it('should extract correlationId from message attributes', () => {
      const record: SQSRecord = {
        messageId: 'msg-123',
        receiptHandle: 'receipt',
        body: '{}',
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {correlationId: {stringValue: 'correlation-from-attr', dataType: 'String'}},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('correlation-from-attr')
    })

    it('should extract correlationId from JSON body when no message attribute', () => {
      const record: SQSRecord = {
        messageId: 'msg-123',
        receiptHandle: 'receipt',
        body: JSON.stringify({correlationId: 'correlation-from-body', data: 'test'}),
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('correlation-from-body')
    })

    it('should fall back to messageId when correlationId not in body', () => {
      const record: SQSRecord = {
        messageId: 'msg-fallback',
        receiptHandle: 'receipt',
        body: JSON.stringify({otherField: 'value'}),
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('msg-fallback')
    })

    it('should fall back to messageId when body is not valid JSON', () => {
      const record: SQSRecord = {
        messageId: 'msg-fallback-json',
        receiptHandle: 'receipt',
        body: 'not valid json',
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('msg-fallback-json')
    })

    it('should fall back to messageId when correlationId in body is not a string', () => {
      const record: SQSRecord = {
        messageId: 'msg-fallback-type',
        receiptHandle: 'receipt',
        body: JSON.stringify({correlationId: 12345}),
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('msg-fallback-type')
    })

    it('should prefer message attribute over body correlationId', () => {
      const record: SQSRecord = {
        messageId: 'msg-123',
        receiptHandle: 'receipt',
        body: JSON.stringify({correlationId: 'correlation-from-body'}),
        attributes: {} as SQSRecord['attributes'],
        messageAttributes: {correlationId: {stringValue: 'correlation-from-attr', dataType: 'String'}},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:region:account:queue',
        awsRegion: 'us-east-1'
      }

      const result = extractCorrelationFromSQS(record)

      expect(result).toBe('correlation-from-attr')
    })
  })

  describe('extractCorrelationFromS3', () => {
    it('should extract x-amz-request-id from S3 event', () => {
      const event: S3Event = {
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

      const result = extractCorrelationFromS3(event)

      expect(result).toBe('s3-request-123')
    })

    it('should fall back to object key when request-id is empty', () => {
      const event: S3Event = {
        Records: [{
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventTime: '2024-01-01T00:00:00.000Z',
          eventName: 'ObjectCreated:Put',
          userIdentity: {principalId: 'EXAMPLE'},
          requestParameters: {sourceIPAddress: '127.0.0.1'},
          responseElements: {'x-amz-request-id': '', 'x-amz-id-2': 'id2'},
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'config-id',
            bucket: {name: 'bucket', ownerIdentity: {principalId: 'EXAMPLE'}, arn: 'arn:aws:s3:::bucket'},
            object: {key: 'fallback/key.txt', size: 100, eTag: 'etag', sequencer: 'seq'}
          }
        }]
      }

      const result = extractCorrelationFromS3(event)

      // Empty request-id falls back to object key (truthy check)
      expect(result).toBe('fallback/key.txt')
    })

    it('should generate timestamp-based fallback when no Records', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))

      const event: S3Event = {Records: []}

      const result = extractCorrelationFromS3(event)

      expect(result).toBe('s3-1704110400000')

      vi.useRealTimers()
    })
  })

  describe('extractCorrelationFromS3Record', () => {
    it('should extract x-amz-request-id from S3 record', () => {
      const record: S3EventRecord = {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-east-1',
        eventTime: '2024-01-01T00:00:00.000Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: {principalId: 'EXAMPLE'},
        requestParameters: {sourceIPAddress: '127.0.0.1'},
        responseElements: {'x-amz-request-id': 'record-request-123', 'x-amz-id-2': 'id2'},
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'config-id',
          bucket: {name: 'bucket', ownerIdentity: {principalId: 'EXAMPLE'}, arn: 'arn:aws:s3:::bucket'},
          object: {key: 'test/file.txt', size: 100, eTag: 'etag', sequencer: 'seq'}
        }
      }

      const result = extractCorrelationFromS3Record(record)

      expect(result).toBe('record-request-123')
    })

    it('should fall back to object key when request-id is empty in record', () => {
      const record: S3EventRecord = {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-east-1',
        eventTime: '2024-01-01T00:00:00.000Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: {principalId: 'EXAMPLE'},
        requestParameters: {sourceIPAddress: '127.0.0.1'},
        responseElements: {'x-amz-request-id': '', 'x-amz-id-2': 'id2'},
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'config-id',
          bucket: {name: 'bucket', ownerIdentity: {principalId: 'EXAMPLE'}, arn: 'arn:aws:s3:::bucket'},
          object: {key: 'record/key.txt', size: 100, eTag: 'etag', sequencer: 'seq'}
        }
      }

      const result = extractCorrelationFromS3Record(record)

      // Empty request-id falls back to object key (truthy check)
      expect(result).toBe('record/key.txt')
    })
  })

  describe('appendCorrelationToLogger', () => {
    it('should append correlationId to logger context', () => {
      appendCorrelationToLogger('test-correlation-id')

      expect(logger.appendKeys).toHaveBeenCalledWith({correlationId: 'test-correlation-id'})
    })
  })

  describe('withCorrelation', () => {
    it('should return object with correlationId key', () => {
      const result = withCorrelation('my-correlation')

      expect(result).toEqual({correlationId: 'my-correlation'})
    })
  })
})
