import {ApiKey, ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlan, UsagePlans, APIGateway} from '@aws-sdk/client-api-gateway'
import {createAPIGatewayClient} from './clients'

// Lazy initialization to avoid module-level client creation (breaks Jest mocking)
let apigateway: APIGateway | null = null
function getClient(): APIGateway {
  if (!apigateway) {
    apigateway = createAPIGatewayClient()
  }
  return apigateway
}

// Re-export types for application code to use
export type {ApiKey, UsagePlan}

export function getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
  return getClient().getApiKeys(params)
}

export function getUsage(params: GetUsageRequest): Promise<Usage> {
  return getClient().getUsage(params)
}

export function getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
  return getClient().getUsagePlans(params)
}
