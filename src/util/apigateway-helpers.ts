import {APIGatewayEvent} from 'aws-lambda'
import {validate} from 'validate.js'
import {DeviceRegistration, UserRegistration, UserSubscribe} from '../types/main'
import {Webhook} from '../types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'
import {validateOptions} from './constraints'

export function validateRequest(requestBody: Webhook | DeviceRegistration | UserRegistration | UserSubscribe, constraints: unknown): void {
  const invalidAttributes = validate(requestBody, constraints, validateOptions)
  if (invalidAttributes) {
    logError('validateRequest =>', invalidAttributes)
    throw new ValidationError('Bad Request', invalidAttributes)
  }
}

export function getPayloadFromEvent(event: APIGatewayEvent): Webhook | DeviceRegistration | UserRegistration | UserSubscribe {
  if ('body' in event) {
    try {
      const requestBody = JSON.parse(event.body)
      logDebug('getPayloadFromEvent.event.body <=', event.body)
      return requestBody
    } catch (error) {
      logError('getPayloadFromEvent =>', `Invalid JSON: ${error}`)
      throw new ValidationError('Request body must be valid JSON')
    }
  }
  throw new ValidationError('Missing request payload')
}
