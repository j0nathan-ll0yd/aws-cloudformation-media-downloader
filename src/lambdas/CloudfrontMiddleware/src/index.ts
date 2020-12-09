import {CloudFrontRequestEvent} from 'aws-lambda'
import {CloudFrontHeaders, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {verifyAccessToken} from '../../../util/secretsmanager-helpers'

export async function handler(event: CloudFrontRequestEvent) {
  logInfo('event <=', event)
  const request = event.Records[0].cf.request
  try {
    await Promise.all([
      handleAuthorizationHeader(request),
      handleQueryString(request)
    ])
  } catch (err) {
    logError('Error handling request', err)
  }
  logDebug('request <=', request)
  return request
}

async function handleAuthorizationHeader(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  const authorizationHeader = headers.authorization[0].value
  const jwtRegex = /^Bearer [A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]+$/
  const matches = authorizationHeader.match(jwtRegex)
  logDebug('headers.authorization <=', matches)
  if (!authorizationHeader.match(jwtRegex)) {
    // Abandon the request, without the X-API-Key header, to produce an authorization error (403)
    throw new Error('headers.Authorization is invalid')
  }

  const keypair = authorizationHeader.split(' ')
  const token = keypair[1]
  try {
    logDebug('verifyAccessToken <=', token)
    // this is required because Lambda@Edge does not support environment variables
    process.env.EncryptionKeySecretId = request.origin.custom.customHeaders['x-encryption-key-secret-id'][0].value
    const payload = await verifyAccessToken(token)
    logDebug('verifyAccessToken =>', payload)
    headers['x-user-Id'] = [
      {
        'key': 'X-User-Id',
        'value': payload.userId
      }
    ]
  } catch(err) {
    logError('invalid JWT token <=', err)
    throw new Error(err)
  }
}

async function handleQueryString(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  const queryString = request.querystring
  const apiKeyRegex = /ApiKey/
  const matches = queryString.match(apiKeyRegex)
  logDebug('request.querystring <=', matches)
  if (!queryString.match(apiKeyRegex)) {
    // Abandon the request, without the X-API-Key header, to produce an authorization error (403)
    throw new Error('request.querystring is invalid')
  }
  const keypair = request.querystring.split('=')
  headers['x-api-key'] = [
    {
      'key': 'X-API-Key',
      'value': keypair[1]
    }
  ]
}
