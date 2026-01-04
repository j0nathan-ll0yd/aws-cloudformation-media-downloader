import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables
} from 'aws-lambda/trigger/apiGateway-proxy'
import {APIGatewayEventIdentity} from 'aws-lambda/common/apiGateway'

/**
 * Custom API Gateway event type that extends the standard AWS Lambda types.
 * Required because the AWS Lambda types include requestContext.identity.clientCert
 * which is not present in actual API Gateway events.
 */
export interface CustomAPIGatewayRequestAuthorizerEvent {
  requestContext: {
    accountId: string
    apiId: string
    // This one is a bit confusing: it is not actually present in authorizer calls
    // and proxy calls without an authorizer. We model this by allowing undefined in the type,
    // since it ends up the same and avoids breaking users that are testing the property.
    // This lets us allow parameterizing the authorizer for proxy events that know what authorizer
    // context values they have.
    authorizer: {integrationLatency: number; principalId: string}
    connectedAt?: number | undefined
    connectionId?: string | undefined
    domainName?: string | undefined
    domainPrefix?: string | undefined
    eventType?: string | undefined
    extendedRequestId?: string | undefined
    protocol: string
    httpMethod: string
    identity: Omit<APIGatewayEventIdentity, 'clientCert'>
    messageDirection?: string | undefined
    messageId?: string | null | undefined
    path: string
    stage: string
    requestId: string
    requestTime?: string | undefined
    requestTimeEpoch: number
    resourceId: string
    resourcePath: string
    routeKey?: string | undefined
  }
  body: string | null
  headers: APIGatewayProxyEventHeaders
  multiValueHeaders: APIGatewayProxyEventMultiValueHeaders
  httpMethod: string
  isBase64Encoded: boolean
  path: string
  pathParameters: APIGatewayProxyEventPathParameters | null
  queryStringParameters: APIGatewayProxyEventQueryStringParameters | null
  multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters | null
  stageVariables: APIGatewayProxyEventStageVariables | null
  resource: string
}

/**
 * Context containing both traceId and correlationId for distributed tracing.
 */
export interface CorrelationContext {
  /** AWS Lambda request ID for this invocation */
  traceId: string
  /** Correlation ID for end-to-end request tracing */
  correlationId: string
}
