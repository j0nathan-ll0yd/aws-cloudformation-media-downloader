import {CloudFrontRequestEvent, CloudFrontResultResponse, Context} from 'aws-lambda'
import {CloudFrontHeaders, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {verifyAccessToken} from '../../../util/secretsmanager-helpers'

export async function handler(event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontRequest|CloudFrontResultResponse> {
  logInfo('event <=', event)
  logInfo('context <=', context)
  const request = event.Records[0].cf.request
  try {
    await Promise.all([
      handleAuthorizationHeader(request),
      handleQueryString(request)
    ])
  } catch (err) {
    logError('Error handling request', err)
    const realm = request.origin.custom.customHeaders['x-www-authenticate-realm'][0].value
    const response = {
      status: '401',
      statusDescription: 'Unauthorized',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/json' }],
        'www-authenticate': [{ key: 'WWW-Authenticate', value: `Bearer realm="${realm}", charset="UTF-8"` }]
      },
      body: JSON.stringify({
        error: { code: 401, message: 'Token expired' },
        requestId: context.awsRequestId
      })
    }
    logError('response => ', response)
    return response
  }
  logDebug('request <=', request)
  return request
}

async function handleAuthorizationHeader(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  // if the request is coming from my IP, mock the Authorization header to map to userId 1
  const reservedIp = request.origin.custom.customHeaders['x-reserved-client-ip'][0].value
  const userAgent = headers['user-agent'][0].value
  if (request.clientIp === reservedIp && userAgent === 'localhost@lifegames') {
    headers['x-user-Id'] = [
      {
        'key': 'X-User-Id',
        'value': 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456'
      }
    ]
    return
  }
  const unprotectedPaths = request.origin.custom.customHeaders['x-unprotected-paths'][0].value.split(',')
  const pathPart = request.uri.substring(1) // remove "/" prefix
  logDebug(`pathPart = ${pathPart}`)
  // If its an unprotected path (doesn't require auth), and there is no Authorization header present, that's fine
  if (unprotectedPaths.find(path => path === pathPart) && !headers.authorization) {
    // TODO: This should be a check that only applys to the login or registration methods
    return
  }
  else {
    throw new Error('headers.Authorization is required')
  }
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
    throw new Error('Invalid Token')
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
