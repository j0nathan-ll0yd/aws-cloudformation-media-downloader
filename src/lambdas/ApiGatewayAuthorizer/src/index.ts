import {
  APIGatewayRequestAuthorizerEvent,
  CustomAuthorizerResult
} from 'aws-lambda'
import {
  logDebug,
  logError,
  logInfo
} from '../../../util/lambda-helpers'
import {
  ApiKey,
  getApiKeys,
  getUsage,
  getUsagePlans,
  UsagePlan
} from '../../../lib/vendor/AWS/ApiGateway'
import {
  providerFailureErrorMessage,
  UnexpectedError
} from '../../../util/errors'
import {validateSessionToken} from '../../../util/better-auth-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

const generatePolicy = (principalId: string, effect: string, resource: string, usageIdentifierKey?: string) => {
  return {
    context: {},
    policyDocument: {
      Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }],
      Version: '2012-10-17'
    },
    principalId,
    usageIdentifierKey
  } as CustomAuthorizerResult
}

export function generateAllow(
  principalId: string,
  resource: string,
  usageIdentifierKey?: string
): CustomAuthorizerResult {
  const policy = generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
  logDebug('response ==', policy)
  return policy
}

export function generateDeny(
  principalId: string,
  resource: string,
  usageIdentifierKey?: string
): CustomAuthorizerResult {
  const policy = generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
  logDebug('response ==', policy)
  return policy
}

/**
 * Returns an array of ApiKeys for API Gateway
 * @notExported
 */
async function fetchApiKeys(): Promise<ApiKey[]> {
  const params = { includeValues: true }
  logDebug('fetchApiKeys <=', params)
  const response = await getApiKeys(params)
  logDebug('fetchApiKeys =>', response)
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items
}

/**
 * Returns an array of UsagePlans for a given APIKey
 * @notExported
 */
async function fetchUsagePlans(keyId: string): Promise<UsagePlan[]> {
  const params = { keyId }
  logDebug('fetchUsagePlans <=', params)
  const response = await getUsagePlans(params)
  logDebug('fetchUsagePlans =>', response)
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items
}

/**
 * Returns an array, by day, of Usage for a given APIKey and UsagePlan
 * @notExported
 */
async function fetchUsageData(keyId: string, usagePlanId: string) {
  const usageDate = new Date().toISOString().split('T')[0]
  const params = { endDate: usageDate, keyId, startDate: usageDate, usagePlanId }
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
  const matches = authorizationHeader.match(bearerRegex)
  logDebug('getPayloadFromAuthenticationHeader.matches <=', JSON.stringify(matches))
  if (!authorizationHeader.match(bearerRegex)) {
    // Abandon the request, without valid Bearer token, to produce an authorization error (403)
    return
  }

  const keypair = authorizationHeader.split(' ')
  const token = keypair[1]
  try {
    logDebug('validateSessionToken <=', token)
    const payload = await validateSessionToken(token)
    logDebug('validateSessionToken =>', payload)
    return payload.userId
  } catch (err) {
    logError('invalid session token <=', err)
    return
  }
}

/**
 * If the request is coming from my IP, use a test userId
 * @param event - A APIGatewayRequestAuthorizerEvent
 * @notExported
 */
function isRemoteTestRequest(event: APIGatewayRequestAuthorizerEvent): boolean {
  if (!event.headers) {
    return false
  }
  const reservedIp = process.env.ReservedClientIp as string
  const userAgent = event.headers['User-Agent']
  const clientIp = event.requestContext.identity.sourceIp
  logDebug('reservedIp <=', reservedIp)
  logDebug('headers.userAgent <=', userAgent)
  logDebug('request.clientIp <=', clientIp)
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
export const handler = withXRay(async (event: APIGatewayRequestAuthorizerEvent): Promise<CustomAuthorizerResult> => {
  logInfo('event <=', event)
  const queryStringParameters = event.queryStringParameters
  if (!queryStringParameters || !('ApiKey' in queryStringParameters)) {
    logInfo('No API key found')
    throw new Error('Unauthorized')
  }
  const apiKeyValue = queryStringParameters.ApiKey
  const apiKeys = await fetchApiKeys()
  const matchedApiKey = apiKeys.filter((item) => item.value === apiKeyValue)
  if (matchedApiKey.length == 0) {
    logInfo('API key is invalid')
    throw new Error('Unauthorized')
  }
  const apiKey = matchedApiKey[0]
  if (apiKey.enabled === false) {
    logInfo('API key is disabled')
    throw new Error('Unauthorized')
  }

  if (isRemoteTestRequest(event)) {
    const fakeUserId = '123e4567-e89b-12d3-a456-426614174000'
    return generateAllow(fakeUserId, event.methodArn, apiKeyValue)
  }

  const apiKeyId = apiKey.id as string
  const usagePlans = await fetchUsagePlans(apiKeyId)
  const usagePlanId = usagePlans[0].id as string
  const usageData = await fetchUsageData(apiKeyId, usagePlanId)
  logInfo('usageData =>', usageData)

  let principalId = 'unknown'
  const pathPart = event.path.substring(1)
  const multiAuthenticationPathsString = process.env.MultiAuthenticationPathParts as string
  const multiAuthenticationPaths = multiAuthenticationPathsString.split(',')
  if (
    event.headers && 'Authorization' in event.headers && event.headers.Authorization !== undefined
  ) {
    const maybeUserId = await getUserIdFromAuthenticationHeader(event.headers.Authorization)
    if (maybeUserId) {
      principalId = maybeUserId
    } else {
      if (multiAuthenticationPaths.includes(pathPart)) {
        logInfo('Multi-authentication path; userId not required')
      } else {
        logInfo('Token is invalid')
        return generateDeny('unknown', event.methodArn)
      }
    }
  } else {
    // If it's not a multi-authentication path, it needs the Authorization header
    if (!multiAuthenticationPaths.includes(pathPart)) {
      return generateDeny('unknown', event.methodArn)
    }
  }
  return generateAllow(principalId, event.methodArn, apiKeyValue)
})
