/**
 * API Gateway Authorizer Service
 *
 * Helper functions for the API Gateway custom authorizer Lambda.
 * Handles authorization denial, policy generation, and remote test detection.
 */
import type {APIGatewayAuthorizerResult} from 'aws-lambda'
import {addMetadata, endSpan, logDebug, logInfo, metrics, MetricUnit} from '@mantleframework/observability'
import {getOptionalEnv} from '@mantleframework/env'
import type {startSpan} from '@mantleframework/observability'

/** Deny authorization with metrics and tracing, then throw */
export function denyAuthorization(span: ReturnType<typeof startSpan>, reason: string): never {
  logInfo(reason)
  metrics.addMetric('AuthorizationDenied', MetricUnit.Count, 1)
  addMetadata(span, 'reason', reason)
  endSpan(span)
  throw new Error('Unauthorized')
}

/** Generates an Allow policy for API Gateway authorization. */
export function generateAllow(
  principalId: string,
  resource: string,
  usageIdentifierKey?: string,
  authContext: Record<string, string> = {}
): APIGatewayAuthorizerResult {
  return {
    context: authContext,
    policyDocument: {Statement: [{Action: 'execute-api:Invoke', Effect: 'Allow', Resource: resource}], Version: '2012-10-17'},
    principalId,
    usageIdentifierKey
  }
}

/** Checks if the request is from a reserved IP for remote testing. SECURITY: Disabled in production. */
export function isRemoteTestRequest(headers: Record<string, string | undefined>, sourceIp: string): boolean {
  if (getOptionalEnv('NODE_ENV', '') === 'production') {
    return false
  }
  const reservedIp = getOptionalEnv('RESERVED_CLIENT_IP', '')
  if (!reservedIp) {
    return false
  }
  const userAgent = headers['User-Agent'] ?? headers['user-agent']
  logDebug('isRemoteTestRequest <=', {reservedIp, userAgent, clientIp: sourceIp})
  return sourceIp === reservedIp && userAgent === 'localhost@lifegames'
}
