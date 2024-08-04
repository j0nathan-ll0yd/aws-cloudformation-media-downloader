import {ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlans, APIGateway} from '@aws-sdk/client-api-gateway'
const apigateway = new APIGateway()

export function getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
  return apigateway.getApiKeys(params)
}

export function getUsage(params: GetUsageRequest): Promise<Usage> {
  return apigateway.getUsage(params)
}

export function getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
  return apigateway.getUsagePlans(params)
}
