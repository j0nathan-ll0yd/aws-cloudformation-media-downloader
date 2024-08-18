import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {fakeJWT, testContext} from '../../../util/jest-setup'

const {default: validateAuthResponse} = await import('./fixtures/validateAuthCodeForToken-200-OK.json', {assert: {type: 'json'}})
const {default: verifyAppleResponse} = await import('./fixtures/verifyAppleToken-200-OK.json', {assert: {type: 'json'}})

jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  createAccessToken: jest.fn().mockReturnValue(fakeJWT),
  validateAuthCodeForToken: jest.fn().mockReturnValue(validateAuthResponse),
  verifyAppleToken: jest.fn().mockReturnValue(verifyAppleResponse)
}))

const {default: putResponse} = await import('./fixtures/putItem-200-OK.json', {assert: {type: 'json'}})
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  scan: jest.fn(),
  deleteItem: jest.fn(),
  query: jest.fn(),
  putItem: jest.fn().mockReturnValue(putResponse),
  updateItem: jest.fn()
}))

const {default: getUsersByAppleDeviceIdentifierResponse} = await import('./fixtures/getUsersByAppleDeviceIdentifier-200-OK.json', {assert: {type: 'json'}})
const getUsersByAppleDeviceIdentifierMock = jest.fn()
jest.unstable_mockModule('../../../util/shared', () => ({
  getUsersByAppleDeviceIdentifier: getUsersByAppleDeviceIdentifierMock
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#RegisterUser', () => {
  const event = JSON.parse(JSON.stringify(eventMock))
  const context = testContext
  beforeEach(() => {
    getUsersByAppleDeviceIdentifierMock.mockReturnValue(getUsersByAppleDeviceIdentifierResponse)
  })
  test('should successfully register a user, if they dont exist', async () => {
    getUsersByAppleDeviceIdentifierMock.mockReturnValue([])
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
  })
  test('should successfully login a user, if they do exist', async () => {
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
  })
  test('should handle an invalid payload', async () => {
    event.body = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
  })
})
