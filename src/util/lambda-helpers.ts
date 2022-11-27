import {APIGatewayEvent, APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import {CustomLambdaError, ServiceUnavailableError, UnauthorizedError} from './errors'
import {unknownErrorToString} from './transformers'
import {UserEventDetails} from '../types/main'
import {UserStatus} from '../types/enums'

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
    } as APIGatewayProxyResult
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
    } as APIGatewayProxyResult
  } else {
    logDebug('response ==', '')
    return {
      body: '',
      headers,
      statusCode
    } as APIGatewayProxyResult
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

export function lambdaErrorResponse(context: Context, error: unknown): APIGatewayProxyResult {
  const defaultStatusCode = 500
  logError('lambdaErrorResponse', JSON.stringify(error))
  /* istanbul ignore else */
  if (error instanceof CustomLambdaError) {
    return response(context, error.statusCode || defaultStatusCode, error.errors || error.message)
  } else if (error instanceof Error) {
    return response(context, defaultStatusCode, error.message)
  } else {
    return response(context, defaultStatusCode, unknownErrorToString(error))
  }
}

function stringify(stringOrObject: object | string | unknown) {
  if (typeof stringOrObject === 'object') {
    stringOrObject = JSON.stringify(stringOrObject, null, 2)
  }
  return stringOrObject
}

export function logInfo(message: string, stringOrObject?: string | object): void {
  console.info(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function logDebug(message: string, stringOrObject?: string | object): void {
  console.log(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function logError(message: string, stringOrObject?: string | object | unknown): void {
  console.error(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function generateUnauthorizedError() {
  return new UnauthorizedError('Invalid Authentication token; login')
}

export function getUserDetailsFromEvent(event: APIGatewayEvent): UserEventDetails {
  let principalId = 'unknown'
  // This should always be present, via the API Gateway
  /* istanbul ignore else */
  if (event.requestContext.authorizer && event.requestContext.authorizer.principalId) {
    principalId = event.requestContext.authorizer.principalId
  }
  const userId = principalId === 'unknown' ? undefined : principalId
  const authHeader = event.headers['Authorization']
  let userStatus: UserStatus
  if (authHeader && userId) {
    userStatus = UserStatus.Authenticated
  } else if (authHeader) {
    userStatus = UserStatus.Unauthenticated
  } else {
    userStatus = UserStatus.Anonymous
  }
  logDebug('getUserDetailsFromEvent.userId', userId)
  logDebug('getUserDetailsFromEvent.userId.typeof', typeof userId)
  logDebug('getUserDetailsFromEvent.authHeader', authHeader)
  logDebug('getUserDetailsFromEvent.userStatus', userStatus.toString())
  return {userId, userStatus} as UserEventDetails
}
