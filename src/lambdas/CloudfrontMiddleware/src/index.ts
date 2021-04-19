import { CloudFrontRequestEvent, CloudFrontResultResponse, CloudFrontResponse, Context } from 'aws-lambda'
import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { cloudFrontErrorResponse, logDebug, logError, logInfo } from '../../../util/lambda-helpers'
import { verifyAccessToken } from '../../../util/secretsmanager-helpers'

export async function handler(event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse> {
  logInfo('event <=', event)
  logInfo('context <=', context)
  const request = event.Records[0].cf.request
  try {
    await Promise.all([handleAuthorizationHeader(request), handleQueryString(request)])
  } catch (err) {
    logError('Error handling request', err)
    const realm = request.origin.custom.customHeaders['x-www-authenticate-realm'][0].value
    const response = cloudFrontErrorResponse(context, 401, err, realm)
    logError('response => ', response)
    return response
  }
  logDebug('request <=', request)
  return request
}

async function handleAuthorizationHeader(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  // if the request is coming from my IP, mock the Authorization header to map to a default userId
  const reservedIp = request.origin.custom.customHeaders['x-reserved-client-ip'][0].value
  const userAgent = headers['user-agent'][0].value
  logDebug('reservedIp <=', reservedIp)
  logDebug('headers.userAgent <=', userAgent)
  logDebug('request.clientIp <=', request.clientIp)
  if (request.clientIp === reservedIp && userAgent === 'localhost@lifegames') {
    headers['x-user-Id'] = [
      {
        key: 'X-User-Id',
        value: 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456'
      }
    ]
    return
  }
  const unauthenticatedPaths = request.origin.custom.customHeaders['x-unauthenticated-paths'][0].value.split(',')
  const multiAuthenticationPaths = request.origin.custom.customHeaders['x-multiauthentication-paths'][0].value.split(',')
  const pathPart = request.uri.substring(1) // remove "/" prefix
  // If its an unauthenticated path (doesn't require auth), we ignore the Authorization header
  if (unauthenticatedPaths.find((path) => path === pathPart)) {
    return
  }
  // If the path supports either authenticated or unauthenticated requests; ensure the header is present
  if (!multiAuthenticationPaths.find((path) => path === pathPart) && !headers.authorization) {
    throw 'headers.Authorization is required'
  }

  if (headers.authorization) {
    const authorizationHeader = headers.authorization[0].value
    const jwtRegex = /^Bearer [A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]+$/
    const matches = authorizationHeader.match(jwtRegex)
    logDebug('headers.authorization <=', matches)
    if (!authorizationHeader.match(jwtRegex)) {
      // Abandon the request, without the X-API-Key header, to produce an authorization error (403)
      throw 'headers.Authorization is invalid'
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
          key: 'X-User-Id',
          value: payload.userId
        }
      ]
    } catch (err) {
      logError('invalid JWT token <=', err)
      throw err
    }
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
    throw 'request.querystring is invalid'
  }
  const keypair = request.querystring.split('=')
  headers['x-api-key'] = [
    {
      key: 'X-API-Key',
      value: keypair[1]
    }
  ]
}
