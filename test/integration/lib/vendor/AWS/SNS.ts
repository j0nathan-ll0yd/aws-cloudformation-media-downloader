/**
 * SNS Test Vendor Wrapper
 *
 * Encapsulates AWS SDK SNS operations used in integration tests.
 * This wrapper exists to maintain the AWS SDK Encapsulation Policy even in test code.
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
  SubscribeCommand,
  UnsubscribeCommand
} from '@aws-sdk/client-sns'
import type {
  CreateEndpointResponse,
  GetEndpointAttributesResponse,
  ListEndpointsByPlatformApplicationResponse,
  ListSubscriptionsByTopicResponse,
  PublishResponse,
  SubscribeResponse
} from '@aws-sdk/client-sns'
import {createSNSClient} from '#lib/vendor/AWS/clients'

const snsClient = createSNSClient()

/**
 * Creates an SNS topic
 *
 * @param topicName - Name of the topic to create
 * @returns Topic ARN
 */
export async function createTopic(topicName: string): Promise<string> {
  const result = await snsClient.send(new CreateTopicCommand({Name: topicName}))
  return result.TopicArn!
}

/**
 * Deletes an SNS topic
 *
 * @param topicArn - ARN of the topic to delete
 */
export async function deleteTopic(topicArn: string): Promise<void> {
  await snsClient.send(new DeleteTopicCommand({TopicArn: topicArn}))
}

/**
 * Creates a platform application for push notifications
 *
 * @param name - Name of the platform application
 * @param platform - Platform type (APNS, APNS_SANDBOX, GCM, etc.)
 * @param attributes - Platform-specific attributes (e.g., credentials)
 * @returns Platform application ARN
 */
export async function createPlatformApplication(name: string, platform: string, attributes: Record<string, string>): Promise<string> {
  const result = await snsClient.send(new CreatePlatformApplicationCommand({Name: name, Platform: platform, Attributes: attributes}))
  return result.PlatformApplicationArn!
}

/**
 * Deletes a platform application
 *
 * @param platformApplicationArn - ARN of the platform application to delete
 */
export async function deletePlatformApplication(platformApplicationArn: string): Promise<void> {
  await snsClient.send(new DeletePlatformApplicationCommand({PlatformApplicationArn: platformApplicationArn}))
}

/**
 * Creates a platform endpoint for a device
 *
 * @param platformApplicationArn - ARN of the platform application
 * @param token - Device token
 * @param customUserData - Optional custom user data
 * @returns Endpoint ARN
 */
export async function createPlatformEndpoint(platformApplicationArn: string, token: string, customUserData?: string): Promise<CreateEndpointResponse> {
  return snsClient.send(new CreatePlatformEndpointCommand({PlatformApplicationArn: platformApplicationArn, Token: token, CustomUserData: customUserData}))
}

/**
 * Deletes a platform endpoint
 *
 * @param endpointArn - ARN of the endpoint to delete
 */
export async function deleteEndpoint(endpointArn: string): Promise<void> {
  await snsClient.send(new DeleteEndpointCommand({EndpointArn: endpointArn}))
}

/**
 * Gets attributes for a platform endpoint
 *
 * @param endpointArn - ARN of the endpoint
 * @returns Endpoint attributes
 */
export async function getEndpointAttributes(endpointArn: string): Promise<GetEndpointAttributesResponse> {
  return snsClient.send(new GetEndpointAttributesCommand({EndpointArn: endpointArn}))
}

/**
 * Lists all endpoints for a platform application
 *
 * @param platformApplicationArn - ARN of the platform application
 * @returns List of endpoints
 */
export async function listPlatformEndpoints(platformApplicationArn: string): Promise<ListEndpointsByPlatformApplicationResponse> {
  return snsClient.send(new ListEndpointsByPlatformApplicationCommand({PlatformApplicationArn: platformApplicationArn}))
}

/**
 * Publishes a message to an SNS topic or endpoint
 *
 * @param params - Publish parameters (TopicArn/TargetArn, Message, etc.)
 * @returns Publish response with MessageId
 */
export async function publish(
  params: {
    TopicArn?: string
    TargetArn?: string
    Message: string
    MessageStructure?: string
    MessageAttributes?: Record<string, {DataType: string; StringValue?: string}>
  }
): Promise<PublishResponse> {
  return snsClient.send(new PublishCommand(params))
}

/**
 * Subscribes an endpoint to a topic
 *
 * @param topicArn - ARN of the topic
 * @param protocol - Subscription protocol (e.g., 'sqs', 'email', 'lambda')
 * @param endpoint - Endpoint to receive notifications
 * @returns Subscription ARN
 */
export async function subscribe(topicArn: string, protocol: string, endpoint: string): Promise<SubscribeResponse> {
  return snsClient.send(new SubscribeCommand({TopicArn: topicArn, Protocol: protocol, Endpoint: endpoint}))
}

/**
 * Unsubscribes from a topic
 *
 * @param subscriptionArn - ARN of the subscription to remove
 */
export async function unsubscribe(subscriptionArn: string): Promise<void> {
  await snsClient.send(new UnsubscribeCommand({SubscriptionArn: subscriptionArn}))
}

/**
 * Lists all subscriptions for a topic
 *
 * @param topicArn - ARN of the topic
 * @returns List of subscriptions
 */
export async function listSubscriptionsByTopic(topicArn: string): Promise<ListSubscriptionsByTopicResponse> {
  return snsClient.send(new ListSubscriptionsByTopicCommand({TopicArn: topicArn}))
}
