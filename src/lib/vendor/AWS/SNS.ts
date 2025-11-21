import {
  CreateEndpointResponse,
  CreatePlatformEndpointInput,
  DeleteEndpointInput,
  ListSubscriptionsByTopicInput,
  ListSubscriptionsByTopicResponse,
  PublishInput,
  PublishResponse,
  SubscribeInput,
  SubscribeResponse,
  UnsubscribeInput,
  SubscribeCommand,
  PublishCommand,
  ListSubscriptionsByTopicCommand,
  CreatePlatformEndpointCommand,
  UnsubscribeCommand,
  DeleteEndpointCommand
} from '@aws-sdk/client-sns'
import {createSNSClient} from './clients'

const snsClient = createSNSClient()

// Re-export types for application code to use
export type {PublishInput}

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function publishSnsEvent(params: PublishInput): Promise<PublishResponse> {
  const command = new PublishCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
  const command = new SubscribeCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function listSubscriptionsByTopic(params: ListSubscriptionsByTopicInput): Promise<ListSubscriptionsByTopicResponse> {
  const command = new ListSubscriptionsByTopicCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function createPlatformEndpoint(params: CreatePlatformEndpointInput): Promise<CreateEndpointResponse> {
  const command = new CreatePlatformEndpointCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function unsubscribe(params: UnsubscribeInput): Promise<object> {
  const command = new UnsubscribeCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function deleteEndpoint(params: DeleteEndpointInput): Promise<object> {
  const command = new DeleteEndpointCommand(params)
  return snsClient.send(command)
}
/* c8 ignore stop */
