import type {z} from 'zod'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {ValidationError} from './errors'
import {logDebug, logError} from './logging'
import type {APIGatewayEvent} from 'aws-lambda'
import {validateSchema} from './constraints'

type PayloadEvent = CustomAPIGatewayRequestAuthorizerEvent | APIGatewayEvent

export function validateRequest<T>(requestBody: unknown, schema: z.ZodSchema<T>): void {
  const validationResult = validateSchema(schema, requestBody)
  if (validationResult && validationResult.errors) {
    logError('validateRequest =>', validationResult.errors)
    throw new ValidationError('Bad Request', validationResult.errors)
  }
}

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
