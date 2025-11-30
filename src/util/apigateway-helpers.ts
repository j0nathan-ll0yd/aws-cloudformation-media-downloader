import Joi from 'joi'
import {CustomAPIGatewayRequestAuthorizerEvent, DeviceRegistrationRequest, UserLogin, UserRegistration, UserSubscribe} from '#types/main'
import {Webhook} from '#types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'
import {APIGatewayEvent} from 'aws-lambda'
import {validateSchema} from './constraints'

type RequestPayload = Webhook | DeviceRegistrationRequest | UserRegistration | UserSubscribe | UserLogin
type PayloadEvent = CustomAPIGatewayRequestAuthorizerEvent | APIGatewayEvent

export function validateRequest(requestBody: RequestPayload, schema: Joi.ObjectSchema): void {
  const validationResult = validateSchema(schema, requestBody)
  if (validationResult && validationResult.errors) {
    logError('validateRequest =>', validationResult.errors)
    throw new ValidationError('Bad Request', validationResult.errors)
  }
}

export function getPayloadFromEvent(event: PayloadEvent): RequestPayload {
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
