/**
 * SNS Test Helpers
 *
 * Utilities for creating SNS topics, platform applications, and endpoints in LocalStack.
 * Used for integration testing push notification workflows.
 */

import {
  createPlatformApplication,
  createPlatformEndpoint,
  createTopic,
  deleteEndpoint,
  deletePlatformApplication,
  deleteTopic,
  getEndpointAttributes,
  listPlatformEndpoints,
  listSubscriptionsByTopic,
  publish,
  subscribe,
  unsubscribe
} from '../lib/vendor/AWS/SNS'

const AWS_REGION = process.env.AWS_REGION || 'us-west-2'
const AWS_ACCOUNT_ID = '000000000000' // LocalStack default account ID

/**
 * Creates a test SNS topic in LocalStack
 *
 * @param topicName - Name of the topic
 * @returns Topic ARN
 */
export async function createTestTopic(topicName: string): Promise<string> {
  try {
    return await createTopic(topicName)
  } catch (error) {
    // Topic might already exist
    if (error instanceof Error && error.name === 'TopicAlreadyExists') {
      return `arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:${topicName}`
    }
    throw error
  }
}

/**
 * Deletes a test SNS topic from LocalStack
 *
 * @param topicArn - ARN of the topic to delete
 */
export async function deleteTestTopic(topicArn: string): Promise<void> {
  try {
    // First, clean up all subscriptions
    const subscriptions = await listSubscriptionsByTopic(topicArn)
    if (subscriptions.Subscriptions) {
      await Promise.all(
        subscriptions.Subscriptions.filter((sub) => sub.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation').map(
          (sub) => unsubscribe(sub.SubscriptionArn!)
        )
      )
    }

    await deleteTopic(topicArn)
  } catch {
    // Topic might not exist
  }
}

/**
 * Creates a test platform application for APNS in LocalStack
 *
 * LocalStack doesn't validate APNS credentials, so we use placeholder values.
 *
 * @param appName - Name of the platform application
 * @returns Platform application ARN
 */
export async function createTestPlatformApplication(appName: string): Promise<string> {
  try {
    return await createPlatformApplication(appName, 'APNS_SANDBOX', {
      // LocalStack accepts any values for testing
      PlatformCredential: 'test-certificate',
      PlatformPrincipal: 'test-private-key'
    })
  } catch (error) {
    // Application might already exist
    if (error instanceof Error && error.name === 'InvalidParameterException') {
      return `arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:app/APNS_SANDBOX/${appName}`
    }
    throw error
  }
}

/**
 * Deletes a test platform application and all its endpoints from LocalStack
 *
 * @param platformApplicationArn - ARN of the platform application to delete
 */
export async function deleteTestPlatformApplication(platformApplicationArn: string): Promise<void> {
  try {
    // First, delete all endpoints
    const endpoints = await listPlatformEndpoints(platformApplicationArn)
    if (endpoints.Endpoints) {
      await Promise.all(endpoints.Endpoints.map((endpoint) => deleteEndpoint(endpoint.EndpointArn!)))
    }

    await deletePlatformApplication(platformApplicationArn)
  } catch {
    // Application might not exist
  }
}

/**
 * Creates a test platform endpoint for a device in LocalStack
 *
 * @param platformApplicationArn - ARN of the platform application
 * @param deviceToken - Device token (can be any string for LocalStack)
 * @param userData - Optional custom user data
 * @returns Endpoint ARN
 */
export async function createTestEndpoint(
  platformApplicationArn: string,
  deviceToken: string,
  userData?: string
): Promise<string> {
  const result = await createPlatformEndpoint(platformApplicationArn, deviceToken, userData)
  return result.EndpointArn!
}

/**
 * Deletes a test endpoint from LocalStack
 *
 * @param endpointArn - ARN of the endpoint to delete
 */
export async function deleteTestEndpoint(endpointArn: string): Promise<void> {
  try {
    await deleteEndpoint(endpointArn)
  } catch {
    // Endpoint might not exist
  }
}

/**
 * Checks if an endpoint exists and is enabled
 *
 * @param endpointArn - ARN of the endpoint to check
 * @returns true if endpoint exists and is enabled
 */
export async function isEndpointEnabled(endpointArn: string): Promise<boolean> {
  try {
    const attributes = await getEndpointAttributes(endpointArn)
    return attributes.Attributes?.Enabled === 'true'
  } catch {
    return false
  }
}

/**
 * Publishes a test message to an SNS endpoint
 *
 * @param endpointArn - ARN of the endpoint
 * @param message - Message to publish
 * @returns MessageId
 */
export async function publishToEndpoint(endpointArn: string, message: string): Promise<string> {
  const result = await publish({
    TargetArn: endpointArn,
    Message: message
  })
  return result.MessageId!
}

/**
 * Publishes a test message to an SNS topic
 *
 * @param topicArn - ARN of the topic
 * @param message - Message to publish
 * @returns MessageId
 */
export async function publishToTopic(topicArn: string, message: string): Promise<string> {
  const result = await publish({
    TopicArn: topicArn,
    Message: message
  })
  return result.MessageId!
}

/**
 * Subscribes an SQS queue to an SNS topic (for testing fanout)
 *
 * @param topicArn - ARN of the topic
 * @param queueArn - ARN of the SQS queue
 * @returns Subscription ARN
 */
export async function subscribeQueueToTopic(topicArn: string, queueArn: string): Promise<string> {
  const result = await subscribe(topicArn, 'sqs', queueArn)
  return result.SubscriptionArn!
}

/**
 * Lists all endpoints for a platform application
 *
 * @param platformApplicationArn - ARN of the platform application
 * @returns Array of endpoint ARNs
 */
export async function listTestEndpoints(platformApplicationArn: string): Promise<string[]> {
  const result = await listPlatformEndpoints(platformApplicationArn)
  return (result.Endpoints || []).map((endpoint) => endpoint.EndpointArn!).filter(Boolean)
}
