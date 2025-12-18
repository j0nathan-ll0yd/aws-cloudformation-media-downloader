import Joi from 'joi'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {DeviceRegistrationRequest, UserLoginInput, UserRegistrationInput, UserSubscribeInput} from '#types/request-types'
import {Webhook} from '#types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'
import {APIGatewayEvent} from 'aws-lambda'
import {validateSchema} from './constraints'

type RequestPayload = Webhook | DeviceRegistrationRequest | UserRegistrationInput | UserSubscribeInput | UserLoginInput
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
