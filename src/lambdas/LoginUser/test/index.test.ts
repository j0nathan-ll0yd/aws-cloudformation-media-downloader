import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import type {MockedFunction} from 'jest-mock'
import {testContext} from '../../../util/jest-setup'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
import {v4 as uuidv4} from 'uuid'

const {default: validateAuthResponse} = await import('./fixtures/validateAuthCodeForToken-200-OK.json', {assert: {type: 'json'}})
const {default: verifyAppleResponse} = await import('./fixtures/verifyAppleToken-200-OK.json', {assert: {type: 'json'}})
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  validateAuthCodeForToken: jest.fn().mockReturnValue(validateAuthResponse),
  verifyAppleToken: jest.fn().mockReturnValue(verifyAppleResponse)
}))

const getUsersByAppleDeviceIdentifierMock = jest.fn() as MockedFunction<() => any>
jest.unstable_mockModule('../../../util/shared', () => ({
  getUsersByAppleDeviceIdentifier: getUsersByAppleDeviceIdentifierMock
}))

// Mock Better Auth helpers for session creation with proper typing
const createUserSessionMock = jest.fn() as MockedFunction<(userId: string, deviceId?: string, ipAddress?: string, userAgent?: string) => Promise<{token: string; expiresAt: number; sessionId: string; userId?: string}>>
jest.unstable_mockModule('../../../util/better-auth-helpers', () => ({
  createUserSession: createUserSessionMock
}))

const {handler} = await import('./../src')

describe('#LoginUser', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    createUserSessionMock.mockReset()
  })
  test('should successfully login a user', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    getUsersByAppleDeviceIdentifierMock.mockReturnValue(scanResponse.Items || [])

    // Mock session creation response
    const sessionId = uuidv4()
    const token = uuidv4()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
    createUserSessionMock.mockResolvedValue({
      token,
      sessionId,
      expiresAt
    })
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('number')
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')
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
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')
    })
  })
})
