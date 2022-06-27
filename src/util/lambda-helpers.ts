import {APIGatewayEvent, APIGatewayProxyEventHeaders, APIGatewayProxyResult, CloudFrontResultResponse, Context} from 'aws-lambda'
import {subscribe} from '../lib/vendor/AWS/SNS'
import {CustomLambdaError, ServiceUnavailableError} from './errors'

export function cloudFrontErrorResponse(context: Context, statusCode: number, message: string, realm?: string): CloudFrontResultResponse {
  let codeText
  const statusCodeString = statusCode.toString()
  if (/^4/.test(statusCodeString)) {
    codeText = 'custom-4XX-generic'
  }
  return {
    status: statusCodeString,
    statusDescription: message,
    headers: {
      'content-type': [{key: 'Content-Type', value: 'application/json'}],
      'www-authenticate': [
        {
          key: 'WWW-Authenticate',
          value: `Bearer realm="${realm}", charset="UTF-8"`
        }
      ]
    },
    body: JSON.stringify({
      error: {code: codeText, message},
      requestId: context.awsRequestId
    })
  }
}

/**
 * Subscribes an endpoint (a client device) to an SNS topic
 * @param endpointArn - The EndpointArn of a mobile app and device
 * @param topicArn - The ARN of the topic you want to subscribe to
 * @notExported
 */
export async function subscribeEndpointToTopic(endpointArn: string, topicArn: string) {
  const subscribeParams = {
    Endpoint: endpointArn,
    Protocol: 'application',
    TopicArn: topicArn
  }
  logDebug('subscribe <=', subscribeParams)
  const subscribeResponse = await subscribe(subscribeParams)
  logDebug('subscribe =>', subscribeResponse)
  return subscribeResponse
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function response(context: Context, statusCode: number, body?: string | object, headers?: APIGatewayProxyEventHeaders): APIGatewayProxyResult {
  let code = 'custom-5XX-generic'
  let error = false
  const statusCodeString = statusCode.toString()
  if (/^4/.test(statusCodeString)) {
    code = 'custom-4XX-generic'
    error = true
  }
  if (/^3/.test(statusCodeString)) {
    code = 'custom-3XX-generic'
    error = true
  } else if (/^5/.test(statusCodeString)) {
    error = true
  }
  if (error) {
    const rawBody = {
      error: {code, message: body},
      requestId: context.awsRequestId
    }
    logDebug('response ==', rawBody)
    return {
      body: JSON.stringify(rawBody),
      headers,
      statusCode
    }
  } else if (body) {
    const rawBody = {
      body,
      requestId: context.awsRequestId
    }
    logDebug('response ==', rawBody)
    return {
      body: JSON.stringify(rawBody),
      headers,
      statusCode
    }
  } else {
    logDebug('response ==', '')
    return {
      body: '',
      headers,
      statusCode
    }
  }
}

/*#__PURE__*/
export function verifyPlatformConfiguration(): void {
  const platformApplicationArn = process.env.PlatformApplicationArn
  logInfo('process.env.PlatformApplicationArn <=', platformApplicationArn)
  if (!platformApplicationArn) {
    throw new ServiceUnavailableError('requires configuration')
  }
}

export function lambdaErrorResponse(context: Context, error: Error): APIGatewayProxyResult {
  logError('lambdaErrorResponse', JSON.stringify(error))
  if (error instanceof CustomLambdaError) {
    return response(context, error.statusCode, error.errors || error.message)
  } else {
    return response(context, 500, error.message)
  }
}

function stringify(stringOrObject) {
  if (typeof stringOrObject === 'object') {
    stringOrObject = JSON.stringify(stringOrObject, null, 2)
  }
  return stringOrObject
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function logInfo(message: string, stringOrObject?: string | object | number): void {
  console.info(message, stringOrObject ? stringify(stringOrObject) : '')
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function logDebug(message: string, stringOrObject?: string | object | number): void {
  console.log(message, stringOrObject ? stringify(stringOrObject) : '')
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function logError(message: string, stringOrObject?: string | object | number): void {
  console.error(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function getUserIdFromEvent(event: APIGatewayEvent): string {
  const userId = event.headers['X-User-Id']
  if (!userId) {
    throw new Error('No X-User-Id in Header')
  }
  return userId
}
