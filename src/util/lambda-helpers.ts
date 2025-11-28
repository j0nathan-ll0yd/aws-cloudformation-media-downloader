import {APIGatewayProxyEventHeaders, APIGatewayProxyResult, Context} from 'aws-lambda'
import {putMetricData, getStandardUnit} from '../lib/vendor/AWS/CloudWatch'
import {CustomLambdaError, ServiceUnavailableError, UnauthorizedError} from './errors'
import {unknownErrorToString} from './transformers'
import {CustomAPIGatewayRequestAuthorizerEvent, UserEventDetails} from '../types/main'
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

export function getUserDetailsFromEvent(event: CustomAPIGatewayRequestAuthorizerEvent): UserEventDetails {
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

/**
 * Publish a custom CloudWatch metric
 * @param metricName - Name of the metric
 * @param value - Numeric value
 * @param unit - Unit of measurement (Seconds, Bytes, Count, etc.)
 * @param dimensions - Optional dimensions for filtering/grouping
 */
export async function putMetric(metricName: string, value: number, unit?: string, dimensions: {Name: string; Value: string}[] = []): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: getStandardUnit(unit),
          Timestamp: new Date(),
          Dimensions: dimensions
        }
      ]
    })
    logDebug(`Published metric: ${metricName}`, {value, unit: unit || 'Count', dimensions})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metric', {metricName, error})
  }
}

/**
 * Publish multiple metrics in a single API call for efficiency
 * @param metrics - Array of metrics to publish
 */
export async function putMetrics(
  metrics: Array<{
    name: string
    value: number
    unit?: string
    dimensions?: {Name: string; Value: string}[]
  }>
): Promise<void> {
  try {
    await putMetricData({
      Namespace: 'MediaDownloader',
      MetricData: metrics.map((m) => ({
        MetricName: m.name,
        Value: m.value,
        Unit: getStandardUnit(m.unit),
        Timestamp: new Date(),
        Dimensions: m.dimensions || []
      }))
    })
    logDebug(`Published ${metrics.length} metrics`, {metrics: metrics.map((m) => m.name)})
  } catch (error) {
    // Don't fail Lambda execution if metrics fail
    logError('Failed to publish CloudWatch metrics', error)
  }
}

/**
 * Sanitize data for test fixtures by removing sensitive fields
 * Recursively processes objects and arrays to redact PII and credentials
 * @param data - Data to sanitize
 * @returns Sanitized copy of data with sensitive fields redacted
 */
function sanitizeForTest(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sanitized = Array.isArray(data) ? [...data] : {...data}

  // Remove sensitive fields
  const sensitiveFields = ['Authorization', 'authorization', 'token', 'Token', 'password', 'Password', 'apiKey', 'ApiKey', 'secret', 'Secret', 'appleDeviceIdentifier']

  for (const key in sanitized) {
    if (sensitiveFields.includes(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForTest(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Log incoming request for fixture extraction from CloudWatch
 * Marks production requests for automated fixture generation
 * @param event - Lambda event (API Gateway request)
 * @param fixtureType - Type identifier for the fixture (e.g., 'feedly-webhook', 'list-files')
 */
export function logIncomingFixture(event: any, fixtureType: string): void {
  if (process.env.ENABLE_FIXTURE_LOGGING === 'true') {
    console.log(
      JSON.stringify({
        __FIXTURE_MARKER__: 'INCOMING',
        fixtureType,
        timestamp: Date.now(),
        data: sanitizeForTest(event)
      })
    )
  }
}

/**
 * Log outgoing response for fixture extraction from CloudWatch
 * Marks production responses for automated fixture generation
 * @param response - Lambda response
 * @param fixtureType - Type identifier for the fixture (e.g., 'feedly-webhook', 'list-files')
 */
export function logOutgoingFixture(response: any, fixtureType: string): void {
  if (process.env.ENABLE_FIXTURE_LOGGING === 'true') {
    console.log(
      JSON.stringify({
        __FIXTURE_MARKER__: 'OUTGOING',
        fixtureType,
        timestamp: Date.now(),
        data: sanitizeForTest(response)
      })
    )
  }
}
