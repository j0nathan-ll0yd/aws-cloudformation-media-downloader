/**
 * API Gateway Key Service
 *
 * Fetches and validates API keys, usage plans, and usage data
 * from AWS API Gateway for request authorization.
 */
import {getApiKeys, getUsage, getUsagePlans} from '@mantleframework/aws'
import {logDebug} from '@mantleframework/observability'
import {UnexpectedError} from '@mantleframework/errors'
import {providerFailureErrorMessage} from '#errors/custom-errors'

type GetApiKeysResult = Awaited<ReturnType<typeof getApiKeys>>
type GetUsagePlansResult = Awaited<ReturnType<typeof getUsagePlans>>

/** Individual API key record from API Gateway */
export type ApiKey = NonNullable<GetApiKeysResult['items']>[number]

/** Usage plan record from API Gateway */
export type UsagePlan = NonNullable<GetUsagePlansResult['items']>[number]

/**
 * Returns an array of ApiKeys for API Gateway.
 *
 * @returns Array of API keys with their values
 */
export async function fetchApiKeys(): Promise<ApiKey[]> {
  const params = {includeValues: true}
  logDebug('fetchApiKeys <=', params)
  const response = await getApiKeys(params)
  logDebug('fetchApiKeys =>', {itemCount: response?.items?.length ?? 0})
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items
}

/**
 * Returns an array of UsagePlans for a given APIKey.
 *
 * @param keyId - The API key ID to fetch usage plans for
 * @returns Array of usage plans associated with the API key
 */
export async function fetchUsagePlans(keyId: string): Promise<UsagePlan[]> {
  const params = {keyId}
  logDebug('fetchUsagePlans <=', params)
  const response = await getUsagePlans(params)
  logDebug('fetchUsagePlans =>', {itemCount: response?.items?.length ?? 0})
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items
}

/**
 * Returns usage data by day for a given APIKey and UsagePlan.
 *
 * @param keyId - The API key ID
 * @param usagePlanId - The usage plan ID
 * @returns Usage data for the current day
 */
export async function fetchUsageData(keyId: string, usagePlanId: string) {
  const usageDate = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
  logDebug('getUsage <=', {usagePlanId, keyId, usageDate})
  const response = await getUsage(usagePlanId, keyId, usageDate, usageDate)
  logDebug('getUsage =>', {hasItems: !!response?.items})
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items[keyId]
}
