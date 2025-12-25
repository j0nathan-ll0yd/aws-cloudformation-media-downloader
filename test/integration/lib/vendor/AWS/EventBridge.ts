/**
 * EventBridge Test Vendor Wrapper
 *
 * Encapsulates AWS SDK EventBridge operations used in integration tests.
 * This wrapper exists to maintain the AWS SDK Encapsulation Policy even in test code.
 */

import {CreateEventBusCommand, DeleteEventBusCommand, DescribeEventBusCommand, ListRulesCommand, PutRuleCommand} from '@aws-sdk/client-eventbridge'
import type {DescribeEventBusCommandOutput, ListRulesCommandOutput, PutRuleCommandOutput} from '@aws-sdk/client-eventbridge'
import {createEventBridgeClient} from '#lib/vendor/AWS/clients'

const eventBridgeClient = createEventBridgeClient()

/**
 * Creates an EventBridge event bus
 * @param eventBusName - Name of the event bus to create
 */
export async function createEventBus(eventBusName: string): Promise<void> {
  await eventBridgeClient.send(new CreateEventBusCommand({Name: eventBusName}))
}

/**
 * Deletes an EventBridge event bus
 * @param eventBusName - Name of the event bus to delete
 */
export async function deleteEventBus(eventBusName: string): Promise<void> {
  await eventBridgeClient.send(new DeleteEventBusCommand({Name: eventBusName}))
}

/**
 * Describes an EventBridge event bus
 * @param eventBusName - Name of the event bus to describe
 */
export async function describeEventBus(eventBusName: string): Promise<DescribeEventBusCommandOutput> {
  return eventBridgeClient.send(new DescribeEventBusCommand({Name: eventBusName}))
}

/**
 * Lists rules on an event bus
 * @param eventBusName - Name of the event bus
 */
export async function listRules(eventBusName: string): Promise<ListRulesCommandOutput> {
  return eventBridgeClient.send(new ListRulesCommand({EventBusName: eventBusName}))
}

/**
 * Creates a rule on an event bus
 * @param eventBusName - Name of the event bus
 * @param ruleName - Name of the rule
 * @param eventPattern - Event pattern to match
 */
export async function putRule(eventBusName: string, ruleName: string, eventPattern: string): Promise<PutRuleCommandOutput> {
  return eventBridgeClient.send(new PutRuleCommand({Name: ruleName, EventBusName: eventBusName, EventPattern: eventPattern}))
}
