import {ApiKey, ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlan, UsagePlans} from '@aws-sdk/client-api-gateway'
import {createAPIGatewayClient} from './clients'

const apigateway = createAPIGatewayClient()

// Re-export types for application code to use
export type {ApiKey, UsagePlan}

export function getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
  return apigateway.getApiKeys(params)
}

export function getUsage(params: GetUsageRequest): Promise<Usage> {
  return apigateway.getUsage(params)
}

export function getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
  return apigateway.getUsagePlans(params)
}
