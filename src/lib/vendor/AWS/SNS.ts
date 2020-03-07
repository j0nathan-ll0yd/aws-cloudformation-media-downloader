import * as AWS from 'aws-sdk'
import {
  CreateEndpointResponse,
  CreatePlatformEndpointInput, ListEndpointsByPlatformApplicationInput, ListEndpointsByPlatformApplicationResponse,
  ListPlatformApplicationsInput, ListPlatformApplicationsResponse,
  PublishInput,
  PublishResponse, SubscribeInput, SubscribeResponse
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

export function listPlatformApplications(params: ListPlatformApplicationsInput): Promise<ListPlatformApplicationsResponse> {
  return new Promise((resolve, reject) => {
    sns.listPlatformApplications(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function listEndpointsByPlatformApplication(params: ListEndpointsByPlatformApplicationInput): Promise<ListEndpointsByPlatformApplicationResponse> {
  return new Promise((resolve, reject) => {
    sns.listEndpointsByPlatformApplication(params, (error, data) => {
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
