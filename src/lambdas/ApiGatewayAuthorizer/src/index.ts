/**
 * ApiGatewayAuthorizer Lambda
 *
 * Custom authorizer for API Gateway using Better Auth sessions.
 * Validates session tokens and generates IAM policies.
 *
 * Trigger: API Gateway (custom authorizer)
 * Input: APIGatewayRequestAuthorizerEvent with Authorization header
 * Output: CustomAuthorizerResult with IAM policy
 */
import type {APIGatewayRequestAuthorizerEvent, CustomAuthorizerResult} from 'aws-lambda'
import {getApiKeys, getUsage, getUsagePlans} from '#lib/vendor/AWS/ApiGateway'
import type {ApiKey, UsagePlan} from '#lib/vendor/AWS/ApiGateway'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {validateSessionToken} from '#lib/domain/auth/sessionService'
import {getOptionalEnv, getRequiredEnv} from '#lib/system/env'
import {providerFailureErrorMessage, UnexpectedError} from '#lib/system/errors'
import {metrics, MetricUnit, withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapAuthorizer} from '#lib/lambda/middleware/legacy'
import {logDebug, logError, logInfo} from '#lib/system/logging'

const generatePolicy = (principalId: string, effect: string, resource: string, usageIdentifierKey?: string) => {
  return {
    context: {},
    policyDocument: {
      Statement: [
        {Action: 'execute-api:Invoke', Effect: effect, Resource: resource}
      ],
      Version: '2012-10-17'
    },
    principalId,
    usageIdentifierKey
  } as CustomAuthorizerResult
}

/**
 * Generates an Allow policy for API Gateway authorization.
 *
 * @param principalId - The principal ID for the policy
 * @param resource - The API Gateway resource ARN
 * @param usageIdentifierKey - Optional API key identifier for usage tracking
 * @returns Custom authorizer result with Allow effect
 */
export function generateAllow(principalId: string, resource: string, usageIdentifierKey?: string): CustomAuthorizerResult {
  return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
}

/**
 * Generates a Deny policy for API Gateway authorization.
 *
 * @param principalId - The principal ID for the policy
 * @param resource - The API Gateway resource ARN
 * @param usageIdentifierKey - Optional API key identifier for usage tracking
 * @returns Custom authorizer result with Deny effect
 */
export function generateDeny(principalId: string, resource: string, usageIdentifierKey?: string): CustomAuthorizerResult {
  return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
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
  logDebug('fetchApiKeys =>', response)
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
  logDebug('fetchUsagePlans =>', response)
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
  const usageDate = new Date().toISOString().split('T')[0]
  const params = {endDate: usageDate, keyId, startDate: usageDate, usagePlanId}
  logDebug('getUsage <=', params)
  const response = await getUsage(params)
  logDebug('getUsage =>', response)
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
  const token = keypair[1]
  try {
    const payload = await validateSessionToken(token)
    return payload.userId
  } catch (err) {
    logError('invalid session token <=', err)
    return
  }
}

/**
 * Checks if the request is coming from a reserved IP for remote testing.
 * SECURITY: This bypass is disabled in production environments.
 *
 * @param event - The API Gateway request authorizer event
 * @returns True if the request is from the reserved test IP and user agent
 * @notExported
 */
function isRemoteTestRequest(event: APIGatewayRequestAuthorizerEvent): boolean {
  // Security: Never allow test bypass in production
  const nodeEnv = getOptionalEnv('NODE_ENV', '')
  if (nodeEnv === 'production') {
    return false
  }

  if (!event.headers) {
    return false
  }
  const reservedIp = getOptionalEnv('RESERVED_CLIENT_IP', '')
  if (!reservedIp) {
    return false
  }
  const userAgent = event.headers['User-Agent']
  const clientIp = event.requestContext.identity.sourceIp
  logDebug('isRemoteTestRequest <=', {reservedIp, userAgent, clientIp})
  return clientIp === reservedIp && userAgent === 'localhost@lifegames'
}

/**
 * A custom Lambda Authorizer that handles the Authentication header
 * There are (3) possible outcomes from this method:
 * - Returns a policy with Effect: Allow ... forwards the request
 * - Returns a policy with Effect: Deny ... translated into 403
 * - Returns new Error('Unauthorized') ... translated into 401
 * - Returns callback(Error) ... translated into 500
 * @notExported
 */
export const handler = withPowertools(wrapAuthorizer(async ({event}) => {
  // Track authorization attempt
  metrics.addMetric('AuthorizationAttempt', MetricUnit.Count, 1)

  const span = startSpan('authorize-request')
  addAnnotation(span, 'path', event.path)

  const queryStringParameters = event.queryStringParameters
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
  const apiKey = matchedApiKey[0]
  if (apiKey.enabled === false) {
    logInfo('API key is disabled')
    metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
    addMetadata(span, 'reason', 'api_key_disabled')
    endSpan(span)
    throw new Error('Unauthorized')
  }

  if (isRemoteTestRequest(event)) {
    const fakeUserId = '123e4567-e89b-12d3-a456-426614174000'
    metrics.addMetric('AuthorizationSuccess', MetricUnit.Count, 1)
    addAnnotation(span, 'principalId', fakeUserId)
    addMetadata(span, 'testRequest', true)
    endSpan(span)
    return generateAllow(fakeUserId, event.methodArn, apiKeyValue)
  }

  const apiKeyId = apiKey.id as string
  const usagePlans = await fetchUsagePlans(apiKeyId)
  const usagePlanId = usagePlans[0].id as string
  const usageData = await fetchUsageData(apiKeyId, usagePlanId)
  logInfo('usageData =>', usageData)

  let principalId = 'unknown'
  const pathPart = event.path.substring(1)
  const multiAuthenticationPathsString = getRequiredEnv('MULTI_AUTHENTICATION_PATH_PARTS')
  const multiAuthenticationPaths = multiAuthenticationPathsString.split(',')
  if (event.headers && 'Authorization' in event.headers && event.headers.Authorization !== undefined) {
    const maybeUserId = await getUserIdFromAuthenticationHeader(event.headers.Authorization)
    if (maybeUserId) {
      principalId = maybeUserId
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

  return generateAllow(principalId, event.methodArn, apiKeyValue)
}))
