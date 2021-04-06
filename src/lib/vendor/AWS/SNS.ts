import * as AWS from 'aws-sdk'
import {
  ConfirmSubscriptionInput, ConfirmSubscriptionResponse,
  CreateEndpointResponse,
  CreatePlatformEndpointInput, ListSubscriptionsByTopicInput, ListSubscriptionsByTopicResponse,
  PublishInput,
  PublishResponse, SubscribeInput, SubscribeResponse, UnsubscribeInput
} from 'aws-sdk/clients/sns'
import * as AWSXRay from 'aws-xray-sdk'
const sns = AWSXRay.captureAWSClient(new AWS.SNS({apiVersion: '2010-03-31'}))

export function publishSnsEvent(params: PublishInput): Promise<PublishResponse> {
  return new Promise((resolve, reject) => {
    sns.publish(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function subscribe(params: SubscribeInput): Promise<SubscribeResponse> {
  return new Promise((resolve, reject) => {
    sns.subscribe(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function confirmSubscription(params: ConfirmSubscriptionInput): Promise<ConfirmSubscriptionResponse> {
  return new Promise((resolve, reject) => {
    sns.confirmSubscription(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function listSubscriptionsByTopic(params: ListSubscriptionsByTopicInput): Promise<ListSubscriptionsByTopicResponse> {
  return new Promise((resolve, reject) => {
    sns.listSubscriptionsByTopic(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function createPlatformEndpoint(params: CreatePlatformEndpointInput): Promise<CreateEndpointResponse> {
  return new Promise((resolve, reject) => {
    sns.createPlatformEndpoint(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function unsubscribe(params: UnsubscribeInput): Promise<object> {
  return new Promise((resolve, reject) => {
    sns.unsubscribe(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}
