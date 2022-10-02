import {CloudFrontRequestEvent, CloudFrontResultResponse, CloudFrontResponse, Context} from 'aws-lambda'
import {CloudFrontHeaders, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import {cloudFrontErrorResponse, logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {assertIsError} from '../../../util/transformers'
import {CustomCloudFrontRequest} from '../../../types/main'
import {ValidationError} from '../../../util/errors'

/**
 * For **every request** to the system:
 * - Validate the `Authentication` header (if applicable)
 * - Validate the querystring: extracting the API Key
 */
export async function handler(event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse> {
  logInfo('event <=', event)
  logInfo('context <=', context)
  const request = event.Records[0].cf.request as CustomCloudFrontRequest
  try {
    await Promise.all([handleAuthorizationHeader(request), handleQueryString(request)])
  } catch (error) {
    assertIsError(error)
    const realm = request.origin.custom.customHeaders['x-www-authenticate-realm'][0].value
    const response = cloudFrontErrorResponse(context, 401, error.message, realm)
    logError('response => ', response)
    return response
  }
  logDebug('request <=', request)
  return request
}

/**
 * Makes various checks for the `Authorization` header:
 * - Checks if the request is for development purposes
 * - Checks if the request ...
 * @param request - A **reference** to the CloudFrontRequest (modified in place)
 * @notExported
 */
async function handleAuthorizationHeader(request: CustomCloudFrontRequest) {
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
}

/**
 * Makes various checks for the querystring:
 * - Checks if the request is for development purposes
 * - Checks if the request ...
 * @param request - A **reference** to the CloudFrontRequest (modified in place)
 * @notExported
 */
async function handleQueryString(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  const queryString = request.querystring
  const apiKeyRegex = /ApiKey/
  const matches = queryString.match(apiKeyRegex)
  logDebug('request.querystring <=', JSON.stringify(matches))
  if (!queryString.match(apiKeyRegex)) {
    // Abandon the request, without the X-API-Key header, to produce an authorization error (403)
    throw new ValidationError('request.querystring is invalid')
  }
  const keypair = request.querystring.split('=')
  headers['x-api-key'] = [
    {
      key: 'X-API-Key',
      value: keypair[1]
    }
  ]
}
