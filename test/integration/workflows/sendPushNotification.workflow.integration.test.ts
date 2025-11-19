/**
 * SendPushNotification Workflow Integration Tests
 *
 * Tests the push notification workflow against LocalStack:
 * 1. Receive SQS FileNotification event
 * 2. Query DynamoDB UserDevices table for user's devices
 * 3. Query DynamoDB Devices table for each device's endpoint ARN
 * 4. Fan-out: Publish SNS notification to each device endpoint
 * 5. Handle errors gracefully (invalid devices, missing endpoints)
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {SQSEvent} from 'aws-lambda'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'

// Test configuration
const TEST_USER_DEVICES_TABLE = 'test-user-devices'
const TEST_DEVICES_TABLE = 'test-devices'

// Set environment variables for Lambda
process.env.DynamoDBTableUserDevices = TEST_USER_DEVICES_TABLE
process.env.DynamoDBTableDevices = TEST_DEVICES_TABLE
process.env.USE_LOCALSTACK = 'true'

describe('SendPushNotification Workflow Integration Tests', () => {
  let handler: any
  let publishSnsEventMock: jest.Mock
  let queryMock: jest.Mock

  beforeAll(async () => {
    // Create LocalStack infrastructure (if needed)
    await createFilesTable()

    // Wait for tables to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    // Clean up LocalStack infrastructure
    await deleteFilesTable()
  })

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Mock SNS publish (don't actually send push notifications)
    publishSnsEventMock = jest.fn<() => Promise<{MessageId: string}>>().mockResolvedValue({MessageId: 'test-sns-message-id'})

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/SNS', () => ({
      publishSnsEvent: publishSnsEventMock,
      publish: publishSnsEventMock
    }))

    // Mock DynamoDB query to return device data
    queryMock = jest.fn()

    jest.unstable_mockModule('../../../src/lib/vendor/AWS/DynamoDB', () => ({
      query: queryMock,
      updateItem: jest.fn(),
      scan: jest.fn()
    }))

    // Import handler AFTER mocks are set up
    const module = await import('../../../src/lambdas/SendPushNotification/src/index')
    handler = module.handler
  })

  test('should query DynamoDB and publish SNS notification for single user with single device', async () => {
    // Arrange: Mock DynamoDB responses
    // First query: getUserDevicesByUserId returns device IDs
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: {S: 'user-123'},
          devices: {SS: ['device-abc']}
        }
      ]
    })

    // Second query: getDevice returns device details
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          deviceId: {S: 'device-abc'},
          endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint'}
        }
      ]
    })

    // SQS event with file notification
    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-1',
          receiptHandle: 'test-receipt-1',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {
              stringValue: 'user-123',
              dataType: 'String'
            },
            fileId: {
              stringValue: 'video-123',
              dataType: 'String'
            },
            title: {
              stringValue: 'Test Video',
              dataType: 'String'
            }
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke SendPushNotification handler
    await handler(event)

    // Assert: DynamoDB queried twice (UserDevices, Devices)
    expect(queryMock).toHaveBeenCalledTimes(2)

    // Verify first query was for UserDevices
    const userDevicesQuery = queryMock.mock.calls[0][0]
    expect(userDevicesQuery.TableName).toBe(TEST_USER_DEVICES_TABLE)

    // Verify second query was for Devices
    const devicesQuery = queryMock.mock.calls[1][0]
    expect(devicesQuery.TableName).toBe(TEST_DEVICES_TABLE)

    // Assert: SNS publish was called once
    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)

    // Verify SNS publish parameters
    const publishParams = publishSnsEventMock.mock.calls[0][0]
    expect(publishParams.TargetArn).toBe('arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/test-endpoint')
  })

  test('should fan-out to multiple devices when user has multiple registered devices', async () => {
    // Arrange: Mock DynamoDB responses
    // First query: getUserDevicesByUserId returns multiple device IDs
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: {S: 'user-456'},
          devices: {SS: ['device-1', 'device-2', 'device-3']}
        }
      ]
    })

    // Subsequent queries: getDevice returns device details for each
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-1'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-1'}}]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-2'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-2'}}]
    })

    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-3'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-3'}}]
    })

    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-2',
          receiptHandle: 'test-receipt-2',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {
              stringValue: 'user-456',
              dataType: 'String'
            },
            fileId: {
              stringValue: 'video-456',
              dataType: 'String'
            },
            title: {
              stringValue: 'Multi-Device Video',
              dataType: 'String'
            }
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler
    await handler(event)

    // Assert: DynamoDB queried 4 times (1 UserDevices + 3 Devices)
    expect(queryMock).toHaveBeenCalledTimes(4)

    // Assert: SNS publish called 3 times (one per device)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(3)

    // Verify all endpoints were targeted
    const targetArns = publishSnsEventMock.mock.calls.map((call) => call[0].TargetArn)
    expect(targetArns).toEqual([
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-1',
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-2',
      'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/endpoint-3'
    ])
  })

  test('should return early when user has no registered devices', async () => {
    // Arrange: Mock DynamoDB to return empty devices
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-3',
          receiptHandle: 'test-receipt-3',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {
              stringValue: 'user-no-devices',
              dataType: 'String'
            },
            fileId: {
              stringValue: 'video-789',
              dataType: 'String'
            }
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler
    await handler(event)

    // Assert: Only one DynamoDB query (UserDevices)
    expect(queryMock).toHaveBeenCalledTimes(1)

    // Assert: No SNS publish (no devices to notify)
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })

  test('should handle invalid device gracefully and continue to next device', async () => {
    // Arrange: Mock DynamoDB responses
    queryMock.mockResolvedValueOnce({
      Items: [
        {
          userId: {S: 'user-789'},
          devices: {SS: ['device-good', 'device-bad']}
        }
      ]
    })

    // First device query succeeds
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-good'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint'}}]
    })

    // Second device query fails (device not found)
    queryMock.mockResolvedValueOnce({
      Items: []
    })

    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-4',
          receiptHandle: 'test-receipt-4',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {
              stringValue: 'user-789',
              dataType: 'String'
            },
            fileId: {
              stringValue: 'video-error',
              dataType: 'String'
            }
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler (should not throw)
    await expect(handler(event)).resolves.not.toThrow()

    // Assert: First device got notification
    expect(publishSnsEventMock).toHaveBeenCalledTimes(1)
    expect(publishSnsEventMock.mock.calls[0][0].TargetArn).toBe('arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/good-endpoint')
  })

  test('should process multiple SQS records in same batch', async () => {
    // Arrange: Mock DynamoDB responses for two different users
    // User 1
    queryMock.mockResolvedValueOnce({
      Items: [{userId: {S: 'user-1'}, devices: {SS: ['device-user1']}}]
    })
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-user1'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user1-endpoint'}}]
    })

    // User 2
    queryMock.mockResolvedValueOnce({
      Items: [{userId: {S: 'user-2'}, devices: {SS: ['device-user2']}}]
    })
    queryMock.mockResolvedValueOnce({
      Items: [{deviceId: {S: 'device-user2'}, endpointArn: {S: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/user2-endpoint'}}]
    })

    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-5a',
          receiptHandle: 'test-receipt-5a',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {stringValue: 'user-1', dataType: 'String'},
            fileId: {stringValue: 'video-batch-1', dataType: 'String'}
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        },
        {
          messageId: 'test-message-5b',
          receiptHandle: 'test-receipt-5b',
          body: 'FileNotification',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {
            userId: {stringValue: 'user-2', dataType: 'String'},
            fileId: {stringValue: 'video-batch-2', dataType: 'String'}
          },
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler
    await handler(event)

    // Assert: DynamoDB queried 4 times (2 users × 2 queries each)
    expect(queryMock).toHaveBeenCalledTimes(4)

    // Assert: SNS published 2 times (one per user)
    expect(publishSnsEventMock).toHaveBeenCalledTimes(2)
  })

  test('should skip non-FileNotification messages', async () => {
    // Arrange: SQS event with different message type
    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-6',
          receiptHandle: 'test-receipt-6',
          body: 'OtherNotificationType',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:test-queue',
          awsRegion: 'us-west-2'
        }
      ]
    }

    // Act: Invoke handler
    await handler(event)

    // Assert: No DynamoDB queries
    expect(queryMock).not.toHaveBeenCalled()

    // Assert: No SNS publish
    expect(publishSnsEventMock).not.toHaveBeenCalled()
  })
})
