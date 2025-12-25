/**
 * EventBridge Test Helpers
 *
 * Utilities for creating and managing EventBridge resources in LocalStack.
 *
 * IMPORTANT: These helpers are for TEST INFRASTRUCTURE setup, not for testing
 * EventBridge functionality. Workflow integration tests should mock EventBridge
 * to test business logic, not AWS SDK behavior.
 *
 * Use cases:
 * - beforeAll/afterAll setup/teardown of LocalStack EventBridge resources
 * - Future infrastructure-level tests that need real EventBridge routing
 */

import {createEventBus, deleteEventBus, describeEventBus} from '../lib/vendor/AWS/EventBridge'

const TEST_EVENT_BUS_NAME = 'test-media-downloader'

/**
 * Get the test event bus name (respects environment override)
 */
export function getTestEventBusName(): string {
  return process.env.EVENT_BUS_NAME || TEST_EVENT_BUS_NAME
}

/**
 * Create the test event bus in LocalStack
 */
export async function createTestEventBus(): Promise<void> {
  const eventBusName = getTestEventBusName()
  try {
    await createEventBus(eventBusName)
  } catch (error) {
    // Event bus might already exist
    if (!(error instanceof Error && error.name === 'ResourceAlreadyExistsException')) {
      throw error
    }
  }
}

/**
 * Delete the test event bus from LocalStack
 */
export async function deleteTestEventBus(): Promise<void> {
  const eventBusName = getTestEventBusName()
  try {
    await deleteEventBus(eventBusName)
  } catch {
    // Event bus might not exist
  }
}

/**
 * Verify the test event bus exists
 */
export async function verifyEventBusExists(): Promise<boolean> {
  const eventBusName = getTestEventBusName()
  try {
    const result = await describeEventBus(eventBusName)
    return result.Name === eventBusName
  } catch {
    return false
  }
}
