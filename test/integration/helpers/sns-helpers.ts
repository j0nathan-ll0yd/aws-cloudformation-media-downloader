/**
 * SNS Test Helpers
 *
 * Utilities for creating SNS topics, platform applications, and endpoints in LocalStack.
 * Used for integration testing push notification workflows.
 *
 * These helpers delegate to the SNS vendor wrapper to maintain AWS SDK Encapsulation Policy.
 */

import crypto from 'crypto'
import {
  createPlatformApplication,
  createPlatformEndpoint,
  createTopic,
  deleteEndpoint,
  deletePlatformApplication,
  deleteTopic,
  getEndpointEnabled,
  listEndpoints,
  listSubscriptions,
  publishToEndpoint,
  publishToTopic,
  subscribeEndpointToTopic,
  subscribeQueueToTopic
} from '../lib/vendor/AWS/SNS'

// Re-export all vendor wrapper functions with test-prefixed names for clarity
export const createTestTopic = createTopic
export const deleteTestTopic = deleteTopic
export const createTestPlatformApplication = createPlatformApplication
export const deleteTestPlatformApplication = deletePlatformApplication
export const createTestEndpoint = createPlatformEndpoint
export const deleteTestEndpoint = deleteEndpoint
export const isEndpointEnabled = getEndpointEnabled
export {publishToEndpoint, publishToTopic, subscribeQueueToTopic, subscribeEndpointToTopic}

/**
 * Lists all endpoints for a platform application
 * @param platformApplicationArn - ARN of the platform application
 * @returns Array of endpoint ARNs
 */
export async function listTestEndpoints(platformApplicationArn: string): Promise<string[]> {
  const endpoints = await listEndpoints(platformApplicationArn)
  return endpoints.map((endpoint) => endpoint.EndpointArn!).filter(Boolean)
}

/**
 * Lists all subscriptions for a topic with structured format
 * @param topicArn - ARN of the topic
 * @returns Array of subscription details
 */
export async function listTestSubscriptions(topicArn: string): Promise<Array<{subscriptionArn: string; endpoint: string; protocol: string}>> {
  const subscriptions = await listSubscriptions(topicArn)
  return subscriptions.map((sub) => ({subscriptionArn: sub.SubscriptionArn!, endpoint: sub.Endpoint!, protocol: sub.Protocol!}))
}

/**
 * Generates a unique, CI-isolated name for SNS platform applications.
 *
 * In CI environments, includes GITHUB_RUN_ID for isolation between workflow runs.
 * Locally, uses timestamp for uniqueness.
 *
 * @param prefix - A descriptive prefix for the application (e.g., 'test-push', 'test-prune')
 * @returns Unique application name with CI isolation
 *
 * @example
 * // In CI: "test-push-run12345-a1b2c3d4"
 * // Local: "test-push-1704067200000-a1b2c3d4"
 * const appName = generateIsolatedAppName('test-push')
 */
export function generateIsolatedAppName(prefix: string): string {
  const runId = process.env.GITHUB_RUN_ID
  const uniqueSuffix = crypto.randomBytes(4).toString('hex')

  if (runId) {
    // CI environment: use run ID for isolation between workflow runs
    return `${prefix}-run${runId}-${uniqueSuffix}`
  }

  // Local environment: use timestamp
  return `${prefix}-${Date.now()}-${uniqueSuffix}`
}
