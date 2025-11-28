import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
import {createBetterAuthMock} from '../../../../test/helpers/better-auth-mock'
import {v4 as uuidv4} from 'uuid'

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// Mock Better Auth API
const authMock = createBetterAuthMock()
jest.unstable_mockModule('../../../lib/vendor/BetterAuth/config', () => ({
  auth: authMock.auth
}))

const {handler} = await import('./../src')

describe('#LoginUser', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    authMock.mocks.signInSocial.mockReset()
  })

  test('should successfully login a user via Better Auth', async () => {
    // Mock Better Auth sign-in response
    const userId = uuidv4()
    const sessionId = uuidv4()
    const token = uuidv4()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    authMock.mocks.signInSocial.mockResolvedValue({
      user: {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(Date.now() - 86400000).toISOString() // Created yesterday
      },
      session: {
        id: sessionId,
        expiresAt
      },
      token
    })

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('number')
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')

    // Verify Better Auth API was called with correct parameters (using idToken only)
    expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          provider: 'apple',
          idToken: expect.objectContaining({
            token: expect.any(String)
          })
        })
      })
    )
  })

  test('should handle Better Auth error when user not found', async () => {
    // Mock Better Auth throwing an error for non-existent user
    authMock.mocks.signInSocial.mockRejectedValue({
      status: 404,
      message: 'User not found'
    })

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-5XX-generic')
  })

  test('should handle Better Auth error for invalid token', async () => {
    // Mock Better Auth throwing an error for invalid ID token
    authMock.mocks.signInSocial.mockRejectedValue({
      status: 401,
      message: 'Invalid ID token'
    })

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-5XX-generic')
  })

  test('should reject an invalid request', async () => {
    event.body = 'not-JSON'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)

    // Better Auth API should not be called if request validation fails
    expect(authMock.mocks.signInSocial).not.toHaveBeenCalled()
  })

  describe('#AWSFailure', () => {
    test('should handle Better Auth API failures gracefully', async () => {
      authMock.mocks.signInSocial.mockRejectedValue(new Error('DynamoDB connection failed'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')
    })
  })
})
