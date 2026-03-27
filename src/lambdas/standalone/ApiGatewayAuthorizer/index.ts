/**
 * ApiGatewayAuthorizer Lambda
 *
 * Custom authorizer for API Gateway using Better Auth sessions.
 * Validates session tokens and generates IAM policies.
 *
 * Trigger: API Gateway (custom authorizer, REQUEST type)
 * Input: APIGatewayRequestAuthorizerEvent with Authorization header
 * Output: APIGatewayAuthorizerResult with IAM policy
 */
import type {APIGatewayAuthorizerResult} from 'aws-lambda'
import {getApiKeys, getUsage, getUsagePlans} from '@mantleframework/aws'
type GetApiKeysResult = Awaited<ReturnType<typeof getApiKeys>>
type GetUsagePlansResult = Awaited<ReturnType<typeof getUsagePlans>>
type ApiKey = NonNullable<GetApiKeysResult['items']>[number]
type UsagePlan = NonNullable<GetUsagePlansResult['items']>[number]
import {defineAuthorizerHandler, defineLambda, UserStatus} from '@mantleframework/core'
import {addAnnotation, addMetadata, endSpan, logDebug, logError, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import {validateSessionToken} from '#domain/auth/sessionService'
import {getOptionalEnv, getRequiredEnv} from '@mantleframework/env'
import {UnexpectedError} from '@mantleframework/errors'
import {providerFailureErrorMessage} from '#errors/custom-errors'

defineLambda({
  secrets: {AUTH_SECRET: 'platform.key'},
  staticEnvVars: {MULTI_AUTHENTICATION_PATH_PARTS: 'device/register,device/event,files', RESERVED_CLIENT_IP: '104.1.88.244'}
})

/**
 * Generates an Allow policy for API Gateway authorization.
 *
 * @param principalId - The principal ID for the policy
 * @param resource - The API Gateway resource ARN
 * @param usageIdentifierKey - Optional API key identifier for usage tracking
 * @returns Custom authorizer result with Allow effect
 */
function generateAllow(
  principalId: string,
  resource: string,
  usageIdentifierKey?: string,
  authContext: Record<string, string> = {}
): APIGatewayAuthorizerResult {
  return {
    context: authContext,
    policyDocument: {
      Statement: [
        {Action: 'execute-api:Invoke', Effect: 'Allow', Resource: resource}
      ],
      Version: '2012-10-17'
    },
    principalId,
    usageIdentifierKey
  }
}

/**
 * Returns an array of ApiKeys for API Gateway.
 *
 * @returns Array of API keys with their values
 * @notExported
 */
async function fetchApiKeys(): Promise<ApiKey[]> {
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
 * @notExported
 */
async function fetchUsagePlans(keyId: string): Promise<UsagePlan[]> {
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
 * Returns an array, by day, of Usage for a given APIKey and UsagePlan.
 *
 * @param keyId - The API key ID
 * @param usagePlanId - The usage plan ID
 * @returns Usage data for the current day
 * @notExported
 */
async function fetchUsageData(keyId: string, usagePlanId: string) {
  const usageDate = new Date().toISOString().split('T')[0] ?? new Date().toISOString()
  logDebug('getUsage <=', {usagePlanId, keyId, usageDate})
  const response = await getUsage(usagePlanId, keyId, usageDate, usageDate)
  logDebug('getUsage =>', {hasItems: !!response?.items})
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items[keyId]
}

async function getUserIdFromAuthenticationHeader(authorizationHeader: string): Promise<string | undefined> {
  // Match Bearer token format (session tokens or JWTs during migration)
  const bearerRegex = /^Bearer [A-Za-z\d-_=.]+$/
  if (!authorizationHeader.match(bearerRegex)) {
    // Abandon the request, without valid Bearer token, to produce an authorization error (403)
    return
  }

  const keypair = authorizationHeader.split(' ')
  const token = keypair[1] ?? ''
  try {
    const payload = await validateSessionToken(token)
    return payload.userId
  } catch (err) {
    logError('invalid session token <=', {error: err instanceof Error ? err.message : String(err)})
    return
  }
}

/**
 * Checks if the request is coming from a reserved IP for remote testing.
 * SECURITY: This bypass is disabled in production environments.
 *
 * @param headers - Request headers
 * @param sourceIp - Client source IP
 * @returns True if the request is from the reserved test IP and user agent
 * @notExported
 */
function isRemoteTestRequest(headers: Record<string, string | undefined>, sourceIp: string): boolean {
  // Security: Never allow test bypass in production
  const nodeEnv = getOptionalEnv('NODE_ENV', '')
  if (nodeEnv === 'production') {
    return false
  }

  const reservedIp = getOptionalEnv('RESERVED_CLIENT_IP', '')
  if (!reservedIp) {
    return false
  }
  const userAgent = headers['User-Agent']
  logDebug('isRemoteTestRequest <=', {reservedIp, userAgent, clientIp: sourceIp})
  return sourceIp === reservedIp && userAgent === 'localhost@lifegames'
}

const authorizer = defineAuthorizerHandler({operationName: 'ApiGatewayAuthorizer', type: 'request'})

export const handler = authorizer(async ({event, headers, queryStringParameters, methodArn}) => {
  // Track authorization attempt
  metrics.addMetric('AuthorizationAttempt', MetricUnit.Count, 1)

  const span = startSpan('authorize-request')
  addAnnotation(span, 'path', event.path)

  if (!queryStringParameters || !('ApiKey' in queryStringParameters)) {
    logInfo('No API key found')
    metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
    addMetadata(span, 'reason', 'no_api_key')
    endSpan(span)
    throw new Error('Unauthorized')
  }
  const apiKeyValue = queryStringParameters.ApiKey
  const apiKeys = await fetchApiKeys()
  const matchedApiKey = apiKeys.filter((item) => item.value === apiKeyValue)
  if (matchedApiKey.length == 0) {
    logInfo('API key is invalid')
    metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
    addMetadata(span, 'reason', 'invalid_api_key')
    endSpan(span)
    throw new Error('Unauthorized')
  }
  const apiKey = matchedApiKey[0]!
  if (apiKey.enabled === false) {
    logInfo('API key is disabled')
    metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
    addMetadata(span, 'reason', 'api_key_disabled')
    endSpan(span)
    throw new Error('Unauthorized')
  }

  const sourceIp = event.requestContext.identity.sourceIp
  if (isRemoteTestRequest(headers as Record<string, string | undefined>, sourceIp)) {
    const fakeUserId = '123e4567-e89b-12d3-a456-426614174000'
    metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1)
    addAnnotation(span, 'principalId', fakeUserId)
    addMetadata(span, 'testRequest', true)
    endSpan(span)
    return generateAllow(fakeUserId, methodArn, apiKeyValue, {userStatus: UserStatus.Authenticated})
  }

  const apiKeyId = apiKey.id as string
  const usagePlans = await fetchUsagePlans(apiKeyId)
  const usagePlanId = usagePlans[0]!.id as string
  const usageData = await fetchUsageData(apiKeyId, usagePlanId)
  logInfo('usageData =>', {usageData: JSON.stringify(usageData)})

  let principalId = 'anonymous'
  let userStatus: UserStatus = UserStatus.Anonymous
  const pathPart = event.path.substring(1)
  const multiAuthenticationPathsString = getRequiredEnv('MULTI_AUTHENTICATION_PATH_PARTS')
  const multiAuthenticationPaths = multiAuthenticationPathsString.split(',')
  if (headers && 'Authorization' in headers && headers.Authorization !== undefined) {
    const maybeUserId = await getUserIdFromAuthenticationHeader(headers.Authorization)
    if (maybeUserId) {
      principalId = maybeUserId
      userStatus = UserStatus.Authenticated
    } else {
      if (multiAuthenticationPaths.includes(pathPart)) {
        logInfo('Multi-authentication path; userId not required')
      } else {
        // Return 401 to trigger re-login flow in iOS app
        logInfo('Session token invalid or expired')
        metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
        addMetadata(span, 'reason', 'session_invalid')
        endSpan(span)
        throw new Error('Unauthorized')
      }
    }
  } else {
    // If it's not a multi-authentication path, it needs the Authorization header
    if (!multiAuthenticationPaths.includes(pathPart)) {
      // Return 401 to trigger login flow in iOS app
      logInfo('Authorization header missing')
      metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
      addMetadata(span, 'reason', 'auth_header_missing')
      endSpan(span)
      throw new Error('Unauthorized')
    }
  }

  // Track successful authorization
  metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1)
  addAnnotation(span, 'principalId', principalId)
  addMetadata(span, 'success', true)
  endSpan(span)

  return generateAllow(principalId, methodArn, apiKeyValue, {userStatus})
})

// Re-export for testing
export { generateAllow }
