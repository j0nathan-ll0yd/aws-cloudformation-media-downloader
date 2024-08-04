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
  SNSClient,
  SubscribeCommand,
  PublishCommand,
  ListSubscriptionsByTopicCommand,
  CreatePlatformEndpointCommand,
  UnsubscribeCommand,
  DeleteEndpointCommand
} from '@aws-sdk/client-sns'
const sns = new SNSClient()

export function publishSnsEvent(params: PublishInput): Promise<PublishResponse> {
  const command = new PublishCommand(params)
  return sns.send(command)
}

export function subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
  const command = new SubscribeCommand(params)
  return sns.send(command)
}

export function listSubscriptionsByTopic(params: ListSubscriptionsByTopicInput): Promise<ListSubscriptionsByTopicResponse> {
  const command = new ListSubscriptionsByTopicCommand(params)
  return sns.send(command)
}

export function createPlatformEndpoint(params: CreatePlatformEndpointInput): Promise<CreateEndpointResponse> {
  const command = new CreatePlatformEndpointCommand(params)
  return sns.send(command)
}

export function unsubscribe(params: UnsubscribeInput): Promise<object> {
  const command = new UnsubscribeCommand(params)
  return sns.send(command)
}

export function deleteEndpoint(params: DeleteEndpointInput): Promise<object> {
  const command = new DeleteEndpointCommand(params)
  return sns.send(command)
}
