import type {z} from 'zod'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {ValidationError} from '#lib/system/errors'
import {logDebug, logError} from '#lib/system/logging'
import {getOptionalEnv} from '#lib/system/env'
import type {APIGatewayEvent} from 'aws-lambda'
import {validateSchema} from '#lib/validation/constraints'

type PayloadEvent = CustomAPIGatewayRequestAuthorizerEvent | APIGatewayEvent

/** Validates request body against Zod schema, throwing ValidationError on failure. */
export function validateRequest<T>(requestBody: unknown, schema: z.ZodSchema<T>): void {
  const validationResult = validateSchema(schema, requestBody)
  if (validationResult && validationResult.errors) {
    logError('validateRequest =>', validationResult.errors)
    throw new ValidationError('Bad Request', validationResult.errors)
  }
}

/**
 * Validates response body against Zod schema.
 * In dev/test: throws ValidationError on failure.
 * In production: logs warning but doesn't fail the request.
 */
export function validateResponse<T>(responseBody: unknown, schema: z.ZodSchema<T>): void {
  const validationResult = validateSchema(schema, responseBody)
  if (validationResult && validationResult.errors) {
    const nodeEnv = getOptionalEnv('NODE_ENV', '')
    if (nodeEnv === 'development' || nodeEnv === 'test') {
      logError('validateResponse =>', validationResult.errors)
      throw new ValidationError('Response validation failed', validationResult.errors, 500)
    } else {
      logError('response-validation-warning', validationResult.errors)
    }
  }
}

/** Parses and returns JSON body from API Gateway event. */
export function getPayloadFromEvent(event: PayloadEvent): unknown {
  if ('body' in event) {
    if (typeof event.body === 'string') {
      logDebug('getPayloadFromEvent.event.body <=', event.body)
      try {
        const requestBody = JSON.parse(event.body)
        return requestBody
      } catch (error) {
        logError('getPayloadFromEvent =>', `Invalid JSON: ${error}`)
        throw new ValidationError('Request body must be valid JSON')
      }
    } else {
      throw new ValidationError('Request body must be valid JSON string')
    }
  }
  throw new ValidationError('Missing request payload')
}
