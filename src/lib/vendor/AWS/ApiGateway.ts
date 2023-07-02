import {ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlans} from '../../../../node_modules/aws-sdk/clients/apigateway'
import * as AWS from 'aws-sdk'
const apigateway = new AWS.APIGateway({apiVersion: '2016-11-23'})

export function getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
  return apigateway.getApiKeys(params).promise()
}

export function getUsage(params: GetUsageRequest): Promise<Usage> {
  return apigateway.getUsage(params).promise()
}

export function getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
  return apigateway.getUsagePlans(params).promise()
}
