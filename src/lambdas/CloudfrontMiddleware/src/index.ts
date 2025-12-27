/**
 * CloudfrontMiddleware Lambda
 *
 * Lambda@Edge function for CloudFront request processing.
 * Extracts API key from query string and adds as header.
 *
 * Trigger: CloudFront (viewer-request)
 * Input: CloudFrontRequestEvent
 * Output: Modified CloudFrontRequest with headers
 */
import type {CloudFrontRequestEvent, Context} from 'aws-lambda'
import type {CloudFrontHeaders, CloudFrontRequest} from 'aws-lambda/common/cloudfront'
import type {CloudFrontHandlerResult, CustomCloudFrontRequest} from '#types/lambda'
import {logDebug, logInfo} from '#lib/system/logging'
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

/**
 * CloudFront request handler - extracts API key from query string
 * @param event - CloudFront request event
 * @param context - Lambda context
 * @returns Modified request with API key header
 */
export const handler = async (event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontHandlerResult> => {
  // Lambda@Edge can't use logIncomingFixture (no layers), log event for visibility
  logInfo('event <=', event)
  logDebug('context <=', context)
  const request = event.Records[0].cf.request as CustomCloudFrontRequest
  await handleQueryString(request)
  logDebug('request <=', request)
  return request
}
