import * as AWS from 'aws-sdk'
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
  UnsubscribeInput
} from 'aws-sdk/clients/sns'
import * as AWSXRay from 'aws-xray-sdk'
const sns = AWSXRay.captureAWSClient(new AWS.SNS({apiVersion: '2010-03-31'}))

export function publishSnsEvent(params: PublishInput): Promise<PublishResponse> {
  return sns.publish(params).promise()
}

export function subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
  return sns.subscribe(params).promise()
}

export function listSubscriptionsByTopic(params: ListSubscriptionsByTopicInput): Promise<ListSubscriptionsByTopicResponse> {
  return sns.listSubscriptionsByTopic(params).promise()
}

export function createPlatformEndpoint(params: CreatePlatformEndpointInput): Promise<CreateEndpointResponse> {
  return sns.createPlatformEndpoint(params).promise()
}

export function unsubscribe(params: UnsubscribeInput): Promise<object> {
  return sns.unsubscribe(params).promise()
}

export function deleteEndpoint(params: DeleteEndpointInput): Promise<object> {
  return sns.deleteEndpoint(params).promise()
}
