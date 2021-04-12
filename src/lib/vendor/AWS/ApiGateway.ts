import {
  ApiKey,
  GetApiKeyRequest,
  GetUsageRequest, Usage
} from '../../../../node_modules/aws-sdk/clients/apigateway'

import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
const apigateway = AWSXRay.captureAWSClient(new AWS.APIGateway({apiVersion: '2016-11-23'}))

export function getApiKey(apiKey): Promise<ApiKey> {
  return new Promise((resolve, reject) => {
    const params: GetApiKeyRequest = {
      apiKey,
      includeValue: true
    }
    apigateway.getApiKey(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function getUsage(params?: GetUsageRequest): Promise<Usage> {
  return apigateway.getUsage(params).promise()
}
