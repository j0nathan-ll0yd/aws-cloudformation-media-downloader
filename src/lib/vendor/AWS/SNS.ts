import * as AWS from 'aws-sdk'
import {CreateEndpointResponse, CreatePlatformEndpointInput} from 'aws-sdk/clients/sns'
import * as AWSXRay from 'aws-xray-sdk'
const sns = AWSXRay.captureAWSClient(new AWS.SNS({apiVersion: '2010-03-31'}))

export function publishSnsEvent(params) {
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
