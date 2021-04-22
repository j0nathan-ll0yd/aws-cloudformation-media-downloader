import {APIGatewayEvent} from 'aws-lambda'
import {validate} from 'validate.js'
import {DeviceRegistration, UserRegistration, UserSubscribe, ValidationResponse} from '../types/main'
import {Webhook} from '../types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'

export function validateRequest(requestBody: Webhook | DeviceRegistration | UserRegistration | UserSubscribe, constraints: unknown): void {
  const invalidAttributes = validate(requestBody, constraints)
  if (invalidAttributes) {
    logError('processEventAndValidate =>', invalidAttributes)
    throw new ValidationError('Bad Request', 400, invalidAttributes)
  }
}

export function getPayloadFromEvent(event: APIGatewayEvent): Webhook | DeviceRegistration | UserRegistration | UserSubscribe {
  if ('body' in event) {
    try {
      const requestBody = JSON.parse(event.body)
      logDebug('processEventAndValidate.event.body <=', event.body)
      return requestBody
    } catch (error) {
      logError('processEventAndValidate =>', `Invalid JSON: ${error}`)
      throw new ValidationError('Request body must be valid JSON')
    }
  }
  throw new ValidationError('Missing request payload')
}

export function processEventAndValidate(event: APIGatewayEvent, constraints?: unknown): ValidationResponse {
  let requestBody: Webhook | DeviceRegistration | UserRegistration
  if ('body' in event) {
    try {
      requestBody = JSON.parse(event.body)
      logDebug('processEventAndValidate.event.body <=', requestBody)
    } catch (error) {
      logError('processEventAndValidate =>', `Invalid JSON: ${error}`)
      return {statusCode: 400, message: 'Request body must be valid JSON'}
    }
  }
  if (constraints) {
    const invalidAttributes = validate(requestBody, constraints)
    if (invalidAttributes) {
      logError('processEventAndValidate =>', invalidAttributes)
      return {statusCode: 400, message: invalidAttributes}
    }
  }
  return {requestBody}
}
