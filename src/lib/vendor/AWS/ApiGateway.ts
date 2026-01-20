/**
 * API Gateway Vendor Wrapper
 *
 * Encapsulates AWS API Gateway SDK operations with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 *
 * @see src/lib/vendor/AWS/clients.ts for client factory
 * @see src/lib/vendor/AWS/decorators.ts for permission decorators
 */
import type {ApiKey, ApiKeys, GetApiKeysRequest, GetUsagePlansRequest, GetUsageRequest, Usage, UsagePlan, UsagePlans} from '@aws-sdk/client-api-gateway'
import {createAPIGatewayClient} from './clients'
import {RequiresApiGateway} from './decorators'
import {ApiGatewayOperation} from '#types/servicePermissions'

const apigateway = createAPIGatewayClient()

// Re-export types for application code to use
export type { ApiKey, UsagePlan }

/**
 * API Gateway vendor wrapper with declarative permission metadata.
 * Each method declares the AWS permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda IAM policies.
 */
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
class ApiGatewayVendor {
  @RequiresApiGateway('*', [ApiGatewayOperation.GetApiKeys])
  static getApiKeys(params: GetApiKeysRequest): Promise<ApiKeys> {
    return apigateway.getApiKeys(params)
  }

  @RequiresApiGateway('*', [ApiGatewayOperation.GetUsage])
  static getUsage(params: GetUsageRequest): Promise<Usage> {
    return apigateway.getUsage(params)
  }

  @RequiresApiGateway('*', [ApiGatewayOperation.GetUsagePlans])
  static getUsagePlans(params: GetUsagePlansRequest): Promise<UsagePlans> {
    return apigateway.getUsagePlans(params)
  }
}
/* c8 ignore stop */

// Export static methods for backwards compatibility with existing imports
export const getApiKeys = ApiGatewayVendor.getApiKeys.bind(ApiGatewayVendor)
export const getUsage = ApiGatewayVendor.getUsage.bind(ApiGatewayVendor)
export const getUsagePlans = ApiGatewayVendor.getUsagePlans.bind(ApiGatewayVendor)

// Export class for extraction script access
export { ApiGatewayVendor }
