/**
 * SNS Test Helpers
 *
 * Utilities for creating SNS topics, platform applications, and endpoints in LocalStack.
 * Used for integration testing push notification workflows.
 */

import {
  CreatePlatformApplicationCommand,
  CreatePlatformEndpointCommand,
  CreateTopicCommand,
  DeleteEndpointCommand,
  DeletePlatformApplicationCommand,
  DeleteTopicCommand,
  GetEndpointAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
  ListSubscriptionsByTopicCommand,
  PublishCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand
} from '@aws-sdk/client-sns'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const AWS_ACCOUNT_ID = '000000000000' // LocalStack default account ID

const snsClient = new SNSClient({region: AWS_REGION, endpoint: 'http://localhost:4566', credentials: {accessKeyId: 'test', secretAccessKey: 'test'}})

/**
 * Creates a test SNS topic in LocalStack
 * @param topicName
 */
export async function createTestTopic(topicName: string): Promise<string> {
  try {
    const result = await snsClient.send(new CreateTopicCommand({Name: topicName}))
    return result.TopicArn!
  } catch (error) {
    if (error instanceof Error && error.name === 'TopicAlreadyExists') {
      return `arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:${topicName}`
    }
    throw error
  }
}

/**
 * Deletes a test SNS topic from LocalStack
 * @param topicArn
 */
export async function deleteTestTopic(topicArn: string): Promise<void> {
  try {
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({TopicArn: topicArn}))
    if (subscriptions.Subscriptions) {
      await Promise.all(
        subscriptions.Subscriptions.filter((sub) => sub.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation').map((sub) =>
          snsClient.send(new UnsubscribeCommand({SubscriptionArn: sub.SubscriptionArn!}))
        )
      )
    }
    await snsClient.send(new DeleteTopicCommand({TopicArn: topicArn}))
  } catch {
    // Topic might not exist
  }
}

/**
 * Creates a test platform application for APNS in LocalStack
 * @param appName
 */
export async function createTestPlatformApplication(appName: string): Promise<string> {
  try {
    const result = await snsClient.send(
      new CreatePlatformApplicationCommand({
        Name: appName,
        Platform: 'APNS_SANDBOX',
        Attributes: {PlatformCredential: 'test-certificate', PlatformPrincipal: 'test-private-key'}
      })
    )
    return result.PlatformApplicationArn!
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidParameterException') {
      return `arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:app/APNS_SANDBOX/${appName}`
    }
    throw error
  }
}

/**
 * Deletes a test platform application and all its endpoints from LocalStack
 * @param platformApplicationArn
 */
export async function deleteTestPlatformApplication(platformApplicationArn: string): Promise<void> {
  try {
    const endpoints = await snsClient.send(new ListEndpointsByPlatformApplicationCommand({PlatformApplicationArn: platformApplicationArn}))
    if (endpoints.Endpoints) {
      await Promise.all(endpoints.Endpoints.map((endpoint) => snsClient.send(new DeleteEndpointCommand({EndpointArn: endpoint.EndpointArn!}))))
    }
    await snsClient.send(new DeletePlatformApplicationCommand({PlatformApplicationArn: platformApplicationArn}))
  } catch {
    // Application might not exist
  }
}

/**
 * Creates a test platform endpoint for a device in LocalStack
 * @param platformApplicationArn
 * @param deviceToken
 * @param userData
 */
export async function createTestEndpoint(platformApplicationArn: string, deviceToken: string, userData?: string): Promise<string> {
  const result = await snsClient.send(
    new CreatePlatformEndpointCommand({PlatformApplicationArn: platformApplicationArn, Token: deviceToken, CustomUserData: userData})
  )
  return result.EndpointArn!
}

/**
 * Deletes a test endpoint from LocalStack
 * @param endpointArn
 */
export async function deleteTestEndpoint(endpointArn: string): Promise<void> {
  try {
    await snsClient.send(new DeleteEndpointCommand({EndpointArn: endpointArn}))
  } catch {
    // Endpoint might not exist
  }
}

/**
 * Checks if an endpoint exists and is enabled
 * @param endpointArn
 */
export async function isEndpointEnabled(endpointArn: string): Promise<boolean> {
  try {
    const result = await snsClient.send(new GetEndpointAttributesCommand({EndpointArn: endpointArn}))
    return result.Attributes?.Enabled === 'true'
  } catch {
    return false
  }
}

/**
 * Publishes a test message to an SNS endpoint
 * @param endpointArn
 * @param message
 */
export async function publishToEndpoint(endpointArn: string, message: string): Promise<string> {
  const result = await snsClient.send(new PublishCommand({TargetArn: endpointArn, Message: message}))
  return result.MessageId!
}

/**
 * Publishes a test message to an SNS topic
 * @param topicArn
 * @param message
 */
export async function publishToTopic(topicArn: string, message: string): Promise<string> {
  const result = await snsClient.send(new PublishCommand({TopicArn: topicArn, Message: message}))
  return result.MessageId!
}

/**
 * Subscribes an SQS queue to an SNS topic (for testing fanout)
 * @param topicArn
 * @param queueArn
 */
export async function subscribeQueueToTopic(topicArn: string, queueArn: string): Promise<string> {
  const result = await snsClient.send(new SubscribeCommand({TopicArn: topicArn, Protocol: 'sqs', Endpoint: queueArn}))
  return result.SubscriptionArn!
}

/**
 * Lists all endpoints for a platform application
 * @param platformApplicationArn
 */
export async function listTestEndpoints(platformApplicationArn: string): Promise<string[]> {
  const result = await snsClient.send(new ListEndpointsByPlatformApplicationCommand({PlatformApplicationArn: platformApplicationArn}))
  return (result.Endpoints || []).map((endpoint) => endpoint.EndpointArn!).filter(Boolean)
}
