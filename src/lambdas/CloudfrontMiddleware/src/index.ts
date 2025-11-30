import {CloudFrontRequestEvent, CloudFrontResponse, CloudFrontResultResponse, Context} from 'aws-lambda'
import {CloudFrontHeaders, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import {logDebug, logInfo} from '#util/lambda-helpers'
import {CustomCloudFrontRequest} from '#types/main'

type CloudFrontHandlerResult = CloudFrontRequest | CloudFrontResultResponse | CloudFrontResponse
// Note: Lambda@Edge does not support externalized modules (no layers) and has strict size limits
// X-Ray wrapper removed to avoid bundling aws-xray-sdk-core (~1MB) into the deployment package

/**
 * For **every request** to the system:
 * - Extract the API key as a header if sent via querystring (a limitation of API Gateway)
 */
/**
 * Transforms the API key to a header via the querystring (if not already present)
 * @param request - A **reference** to the CloudFrontRequest (modified in place)
 * @notExported
 */
async function handleQueryString(request: CloudFrontRequest) {
  const headers: CloudFrontHeaders = request.headers
  if (headers['x-api-key']) {
    return
  }
  const apiKeyString = 'ApiKey'
  logDebug('pre-new URLSearchParams')
  const params = new URLSearchParams(request.querystring)
  logDebug(typeof params)
  logDebug('pre-has URLSearchParams')
  if (params.has(apiKeyString)) {
    logDebug('pre-get URLSearchParams')
    const apiKeyValue = params.get(apiKeyString) as string
    headers['x-api-key'] = [
      {key: 'X-API-Key', value: apiKeyValue}
    ]
  }
}

export const handler = async (event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontHandlerResult> => {
  logInfo('event <=', event)
  logInfo('context <=', context)
  const request = event.Records[0].cf.request as CustomCloudFrontRequest
  await handleQueryString(request)
  logDebug('request <=', request)
  return request
}
