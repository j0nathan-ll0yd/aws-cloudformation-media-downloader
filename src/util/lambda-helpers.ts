import {APIGatewayEvent, APIGatewayProxyEventHeaders, APIGatewayProxyResult, CloudFrontResultResponse, Context} from 'aws-lambda'

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
