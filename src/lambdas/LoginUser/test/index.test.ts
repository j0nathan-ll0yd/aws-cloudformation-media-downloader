import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {fakeJWT, testContext} from '../../../util/jest-setup'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'

const {default: validateAuthResponse} = await import('./fixtures/validateAuthCodeForToken-200-OK.json', {assert: {type: 'json'}})
const {default: verifyAppleResponse} = await import('./fixtures/verifyAppleToken-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  createAccessToken: jest.fn().mockReturnValue(fakeJWT),
  validateAuthCodeForToken: jest.fn().mockReturnValue(validateAuthResponse),
  verifyAppleToken: jest.fn().mockReturnValue(verifyAppleResponse)
}))

const getUsersByAppleDeviceIdentifierMock = jest.fn()
jest.unstable_mockModule('../../../util/shared', () => ({
  getUsersByAppleDeviceIdentifier: getUsersByAppleDeviceIdentifierMock
}))

const {handler} = await import('./../src')

describe('#LoginUser', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })
  test('should successfully login a user', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    getUsersByAppleDeviceIdentifierMock.mockReturnValue(scanResponse.Items || [])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
  })
  test('should throw an error if a user is not found', async () => {
    getUsersByAppleDeviceIdentifierMock.mockReturnValue([])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(404)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-4XX-generic')
    expect(body.error.message).toEqual("User doesn't exist")
  })
  test('should throw an error if duplicates are found', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-300-MultipleChoices.json', {assert: {type: 'json'}})
    getUsersByAppleDeviceIdentifierMock.mockReturnValue(scanResponse.Items || [])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(300)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-3XX-generic')
    expect(body.error.message).toEqual('Duplicate user detected')
  })
  test('should reject an invalid request', async () => {
    event.body = 'not-JSON'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
  })
  describe('#AWSFailure', () => {
    test('getUsersByAppleDeviceIdentifier returns undefined', async () => {
      getUsersByAppleDeviceIdentifierMock.mockReturnValue(undefined)
      await expect(handler(event, context)).rejects.toThrow()
    })
  })
})
