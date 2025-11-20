import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals'
import {logIncomingFixture, logOutgoingFixture} from './lambda-helpers'

describe('#lambda-helpers', () => {
  let consoleInfoSpy: jest.SpiedFunction<typeof console.info>
  const originalEnv = process.env

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    process.env = {...originalEnv}
  })

  afterEach(() => {
    consoleInfoSpy.mockRestore()
    process.env = originalEnv
  })

  describe('logIncomingFixture', () => {
    test('should log incoming event with Lambda name from environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'
      const event = {body: '{"test": "data"}', headers: {}}

      logIncomingFixture(event)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:INCOMING:WebhookFeedly]', JSON.stringify(event, null, 2))
    })

    test('should log incoming event with UnknownLambda when environment variable not set', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const event = {Records: [{s3: {}}]}

      logIncomingFixture(event)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:INCOMING:UnknownLambda]', JSON.stringify(event, null, 2))
    })

    test('should handle complex nested objects', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'ListFiles'
      const event = {
        requestContext: {
          authorizer: {principalId: 'user-123'}
        },
        headers: {Authorization: 'Bearer token'},
        body: JSON.stringify({filters: {status: 'active'}})
      }

      logIncomingFixture(event)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:INCOMING:ListFiles]', JSON.stringify(event, null, 2))
    })
  })

  describe('logOutgoingFixture', () => {
    test('should log outgoing response with Lambda name from environment', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'WebhookFeedly'
      const response = {statusCode: 200, body: JSON.stringify({status: 'success'})}

      logOutgoingFixture(response)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:OUTGOING:WebhookFeedly]', JSON.stringify(response, null, 2))
    })

    test('should log outgoing response with UnknownLambda when environment variable not set', () => {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const response = {statusCode: 404, body: JSON.stringify({error: 'Not found'})}

      logOutgoingFixture(response)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:OUTGOING:UnknownLambda]', JSON.stringify(response, null, 2))
    })

    test('should handle error responses', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'RegisterDevice'
      const response = {
        statusCode: 500,
        body: JSON.stringify({
          error: {code: 'custom-5XX-generic', message: 'Internal error'},
          requestId: 'abc-123'
        })
      }

      logOutgoingFixture(response)

      expect(consoleInfoSpy).toHaveBeenCalledWith('[FIXTURE:OUTGOING:RegisterDevice]', JSON.stringify(response, null, 2))
    })
  })
})
