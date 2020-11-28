import {CloudFrontRequestEvent} from 'aws-lambda'
import {logDebug, logInfo} from '../../../util/lambda-helpers'

export async function handler(event: CloudFrontRequestEvent) {
  logInfo('event <=', event)
  const request = event.Records[0].cf.request
  if (request.querystring && request.querystring.match(/ApiKey/)) {
    const keypair = request.querystring.split('=')
    const headers = request.headers
    headers['x-api-key'] = [
      {
        'key': 'X-API-Key',
        'value': keypair[1]
      }
    ]
    logDebug('headers <=', headers)
    request.headers = headers
    logDebug('request <=', request)
    return request
  }
  else {
    return request
  }
}
