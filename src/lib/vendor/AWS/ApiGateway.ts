import {
  ApiKey,
  ApiKeys,
  GetApiKeyRequest,
  GetApiKeysRequest, GetUsagePlansRequest,
  GetUsageRequest, Usage, UsagePlans
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

export function getApiKeys(params?: GetApiKeysRequest): Promise<ApiKeys> {
  return new Promise((resolve, reject) => {
    apigateway.getApiKeys(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function getUsage(params?: GetUsageRequest): Promise<Usage> {
  return new Promise((resolve, reject) => {
    apigateway.getUsage(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

export function getUsagePlans(params?: GetUsagePlansRequest): Promise<UsagePlans> {
  return new Promise((resolve, reject) => {
    apigateway.getUsagePlans(params, (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

// Help function to generate an IAM policy
const generatePolicy = (principalId, effect, resource, usageIdentifierKey) => {
  const authResponse = {context: {}, policyDocument: {}, principalId, usageIdentifierKey}
  if (effect && resource) {
    const policyDocument = {Statement: [], Version: '2012-10-17'}
    const statementOne = {
      Action: 'execute-api:Invoke',
      Effect: effect,
      Resource: resource
    }
    statementOne.Resource = resource
    policyDocument.Statement[0] = statementOne
    authResponse.policyDocument = policyDocument
  }

  // Optional output with custom properties of the String, Number or Boolean type.
  authResponse.context = {
    booleanKey: true,
    numberKey: 123,
    stringKey: 'stringval'
  }
  return authResponse
}

export function generateAllow(principalId, resource, usageIdentifierKey?) {
  return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
}

export function generateDeny(principalId, resource, usageIdentifierKey?) {
  return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
}
