/**
 * Integration tests for SNS operations using LocalStack
 *
 * These tests verify SNS functionality against a local AWS emulator
 */

import {describe, expect, test, beforeAll} from '@jest/globals'
import {PublishCommand, CreateTopicCommand, ListTopicsCommand} from '@aws-sdk/client-sns'
import {createLocalSNSClient} from '../../../util/localstack-helpers.js'

describe('SNS Operations (LocalStack Integration)', () => {
  let snsClient: ReturnType<typeof createLocalSNSClient>
  let testTopicArn: string

  beforeAll(async () => {
    snsClient = createLocalSNSClient()

    // Create a test topic
    const createResult = await snsClient.send(
      new CreateTopicCommand({
        Name: 'test-topic-integration'
      })
    )
    testTopicArn = createResult.TopicArn!
  })

  test('should create and list SNS topics', async () => {
    const result = await snsClient.send(new ListTopicsCommand({}))

    expect(result.Topics).toBeDefined()
    expect(result.Topics!.length).toBeGreaterThan(0)

    // Verify our test topic is in the list
    const topicArns = result.Topics!.map((topic) => topic.TopicArn)
    expect(topicArns).toContain(testTopicArn)
  })

  test('should publish message to SNS topic', async () => {
    const testMessage = {
      title: 'Test Notification',
      body: 'This is a test push notification',
      data: {
        fileId: 'test-123',
        status: 'Downloaded'
      }
    }

    const result = await snsClient.send(
      new PublishCommand({
        TopicArn: testTopicArn,
        Message: JSON.stringify(testMessage),
        Subject: 'Test Push Notification'
      })
    )

    expect(result.MessageId).toBeDefined()
    expect(typeof result.MessageId).toBe('string')
  })

  test('should publish message with attributes', async () => {
    const result = await snsClient.send(
      new PublishCommand({
        TopicArn: testTopicArn,
        Message: 'Test message with attributes',
        MessageAttributes: {
          type: {
            DataType: 'String',
            StringValue: 'notification'
          },
          priority: {
            DataType: 'Number',
            StringValue: '1'
          }
        }
      })
    )

    expect(result.MessageId).toBeDefined()
  })

  test('should handle invalid topic ARN gracefully', async () => {
    const invalidTopicArn = 'arn:aws:sns:us-east-1:000000000000:non-existent-topic'

    await expect(
      snsClient.send(
        new PublishCommand({
          TopicArn: invalidTopicArn,
          Message: 'This should fail'
        })
      )
    ).rejects.toThrow()
  })
})
