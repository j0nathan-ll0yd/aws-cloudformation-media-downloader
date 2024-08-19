import {validate} from 'validate.js'
import {CustomAPIGatewayRequestAuthorizerEvent, DeviceRegistrationRequest, UserLogin, UserRegistration, UserSubscribe} from '../types/main'
import {Webhook} from '../types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'
import {validateOptions} from './constraints'
import {APIGatewayEvent} from 'aws-lambda'

export function validateRequest(requestBody: Webhook | DeviceRegistrationRequest | UserRegistration | UserSubscribe | UserLogin, constraints: unknown): void {
  const invalidAttributes = validate(requestBody, constraints, validateOptions)
  if (invalidAttributes) {
    logError('validateRequest =>', invalidAttributes)
    throw new ValidationError('Bad Request', invalidAttributes)
  }
}

export function getPayloadFromEvent(event: CustomAPIGatewayRequestAuthorizerEvent | APIGatewayEvent): Webhook | DeviceRegistrationRequest | UserRegistration | UserSubscribe | UserLogin {
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
