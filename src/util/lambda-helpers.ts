import axios, {AxiosRequestConfig} from 'axios'
import {APIGatewayEvent, APIGatewayProxyEventHeaders, APIGatewayProxyResult, CloudFrontResultResponse, Context} from 'aws-lambda'
import {subscribe} from '../lib/vendor/AWS/SNS'
import { CustomLambdaError, providerFailureErrorMessage, ServiceUnavailableError, UnauthorizedError, UnexpectedError } from "./errors"
import {unknownErrorToString} from './transformers'
import { User } from "../types/main"
import { getUserByAppleDeviceIdentifierParams } from "./dynamodb-helpers"
import { scan } from "../lib/vendor/AWS/DynamoDB"

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

/**
 * Searches for a User record via their Apple Device ID
 * @param userDeviceId - The subject registered claim that identifies the principal user.
 */
export async function getUsersByAppleDeviceIdentifier(userDeviceId: string): Promise<User[]> {
  const scanParams = getUserByAppleDeviceIdentifierParams(process.env.DynamoDBTableUsers as string, userDeviceId)
  logDebug('getUsersByAppleDeviceIdentifier <=', scanParams)
  const scanResponse = await scan(scanParams)
  logDebug('getUsersByAppleDeviceIdentifier =>', scanResponse)
  if (!scanResponse || !scanResponse.Items) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }
  return scanResponse.Items as User[]
}

/**
 * Makes an HTTP request via Axios
 * @param options - The [request configuration](https://github.com/axios/axios#request-config)
 * @notExported
 */
export async function makeHttpRequest(options: AxiosRequestConfig) {
  logDebug('axios <= ', options)
  const axiosResponse = await axios(options)
  logDebug('axios.status =>', `${axiosResponse.status} ${axiosResponse.statusText}`)
  logDebug('axios.headers =>', axiosResponse.headers)
  return axiosResponse
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

export function getUserIdFromEvent(event: APIGatewayEvent): string {
  const userId = event.headers['X-User-Id']
  if (!userId) {
    throw new UnauthorizedError('No X-User-Id in Header')
  }
  return userId
}
