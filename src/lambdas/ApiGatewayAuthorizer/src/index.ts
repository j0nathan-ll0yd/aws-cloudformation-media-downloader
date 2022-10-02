import {APIGatewayRequestAuthorizerEvent, CustomAuthorizerResult} from 'aws-lambda'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {getApiKeys, getUsage, getUsagePlans} from '../../../lib/vendor/AWS/ApiGateway'
import {providerFailureErrorMessage, UnexpectedError} from '../../../util/errors'
import {ApiKey, ListOfLong, ListOfUsagePlan} from 'aws-sdk/clients/apigateway'
import {verifyAccessToken} from '../../../util/secretsmanager-helpers'

const generatePolicy = (principalId: string, effect: string, resource: string, usageIdentifierKey?: string) => {
  return {
    context: {},
    policyDocument: {
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ],
      Version: '2012-10-17'
    },
    principalId,
    usageIdentifierKey
  }
}

export function generateAllow(principalId: string, resource: string, usageIdentifierKey?: string): CustomAuthorizerResult {
  return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
}

export function generateDeny(principalId: string, resource: string, usageIdentifierKey?: string): CustomAuthorizerResult {
  return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
}

/**
 * Returns a array of ApiKeys for API Gateway
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
 * Returns a array of UsagePlans for a given APIKey
 * @notExported
 */
async function fetchUsagePlans(keyId: string): Promise<ListOfUsagePlan> {
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
 * Returns an array, by day, of Usage for a given APIKey and UsagePlan
 * @notExported
 */
async function fetchUsageData(keyId: string, usagePlanId: string): Promise<ListOfLong[]> {
  const usageDate = new Date().toISOString().split('T')[0]
  const params = {
    endDate: usageDate,
    keyId,
    startDate: usageDate,
    usagePlanId
  }
  logDebug('getUsage <=', params)
  const response = await getUsage(params)
  logDebug('getUsage =>', response)
  if (!response || !response.items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return response.items[keyId]
}

async function getUserIdFromAuthenticationHeader(authorizationHeader: string): Promise<string | undefined> {
  const jwtRegex = /^Bearer [A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]+$/
  const matches = authorizationHeader.match(jwtRegex)
  logDebug('getPayloadFromAuthenticationHeader.matches <=', JSON.stringify(matches))
  if (!authorizationHeader.match(jwtRegex)) {
    // Abandon the request, without the X-API-Key header, to produce an authorization error (403)
    return
  }

  const keypair = authorizationHeader.split(' ')
  const token = keypair[1]
  try {
    logDebug('verifyAccessToken <=', token)
    const payload = await verifyAccessToken(token)
    logDebug('verifyAccessToken =>', payload)
    return payload.userId
  } catch (err) {
    logError('invalid JWT token <=', err)
    return
  }
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
export async function handler(event: APIGatewayRequestAuthorizerEvent): Promise<CustomAuthorizerResult> {
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
  const apiKeyId = apiKey.id as string
  const usagePlans = await fetchUsagePlans(apiKeyId)
  const usagePlanId = usagePlans[0].id as string
  const usageData = await fetchUsageData(apiKeyId, usagePlanId)
  logInfo('usageData =>', usageData)

  let principalId = 'unknown'
  const pathPart = event.path.substring(1)
  const multiAuthenticationPaths = process.env.MultiAuthenticationPathParts.split(',')
  if (event.headers && 'Authorization' in event.headers && event.headers.Authorization !== undefined) {
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
  }
  return generateAllow(principalId, event.methodArn, apiKeyValue)
}
