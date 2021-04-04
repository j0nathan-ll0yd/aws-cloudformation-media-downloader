// Helper function to generate an IAM policy
// https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-output.html
import {APIGatewayEvent, CustomAuthorizerResult} from 'aws-lambda'
import {validate} from 'validate.js'
import {DeviceRegistration, UserRegistration, UserSubscribe} from '../types/main'
import {ScheduledEvent} from '../types/vendor/Amazon/CloudWatch/ScheduledEvent'
import {Webhook} from '../types/vendor/IFTTT/Feedly/Webhook'
import {ValidationError} from './errors'
import {logDebug, logError} from './lambda-helpers'

const generatePolicy = (principalId, effect, resource, usageIdentifierKey) => {
    return {
        context: {},
        policyDocument: {
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource
                }
            ],
            Version: '2012-10-17'
        },
        principalId,
        usageIdentifierKey
    }
}

export function generateAllow(principalId, resource, usageIdentifierKey?): CustomAuthorizerResult {
    return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
}

export function generateDeny(principalId, resource, usageIdentifierKey?): CustomAuthorizerResult {
    return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
}

export function validateRequest(requestBody: Webhook | DeviceRegistration | UserRegistration | UserSubscribe, constraints) {
    const invalidAttributes = validate(requestBody, constraints)
    if (invalidAttributes) {
        logError('processEventAndValidate =>', invalidAttributes)
        throw new ValidationError('Bad Request', 400, invalidAttributes)
    }
}

export function getPayloadFromEvent(event: APIGatewayEvent) {
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

export function processEventAndValidate(event: APIGatewayEvent | ScheduledEvent, constraints?) {
    let requestBody: Webhook | DeviceRegistration | UserRegistration
    if ('source' in event && event.source === 'aws.events') {
        return {statusCode: 200, message: {status: 'OK'}}
    } else if ('body' in event) {
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
