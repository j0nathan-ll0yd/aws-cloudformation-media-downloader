import type {ApiKey, ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlan, UsagePlans} from '@aws-sdk/client-api-gateway'
import {createAPIGatewayClient} from './clients'

const apigateway = createAPIGatewayClient()

// Re-export types for application code to use
export type { ApiKey, UsagePlan }

/** Retrieves API keys matching the specified criteria. */
export function getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
  return apigateway.getApiKeys(params)
}

/** Retrieves usage data for the specified API key and usage plan. */
export function getUsage(params: GetUsageRequest): Promise<Usage> {
  return apigateway.getUsage(params)
}

/** Retrieves all usage plans for the API. */
export function getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
  return apigateway.getUsagePlans(params)
}
