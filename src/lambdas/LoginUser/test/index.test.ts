import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import {createBetterAuthMock} from '#test/helpers/better-auth-mock'
import {createAPIGatewayEvent, createLoginUserBody} from '#test/helpers/event-factories'
import {v4 as uuidv4} from 'uuid'

// Mock Better Auth API - now exports getAuth as async function
const authMock = createBetterAuthMock()
vi.mock('#lib/vendor/BetterAuth/config', () => ({getAuth: vi.fn(async () => authMock.auth)}))

const {handler} = await import('./../src')

describe('#LoginUser', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent

  beforeEach(() => {
    event = createAPIGatewayEvent({path: '/loginUser', httpMethod: 'POST', body: createLoginUserBody()})
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
      session: {id: sessionId, expiresAt},
      token
    })

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('string') // ISO 8601 timestamp
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')

    // Verify Better Auth API was called with correct parameters (using idToken only)
    expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({body: expect.objectContaining({provider: 'apple', idToken: expect.objectContaining({token: expect.any(String)})})})
    )
  })

  test('should handle Better Auth error when user not found', async () => {
    // Mock Better Auth throwing an error for non-existent user
    authMock.mocks.signInSocial.mockRejectedValue({status: 404, message: 'User not found'})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(404)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-4XX-generic')
  })

  test('should handle Better Auth error for invalid token', async () => {
    // Mock Better Auth throwing an error for invalid ID token
    authMock.mocks.signInSocial.mockRejectedValue({status: 401, message: 'Invalid ID token'})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-4XX-generic')
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

  describe('#EdgeCases', () => {
    test('should handle missing idToken in request', async () => {
      event.body = JSON.stringify({})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(400)
      expect(authMock.mocks.signInSocial).not.toHaveBeenCalled()
    })

    test('should handle empty idToken string', async () => {
      // Empty string passes Zod validation but Better Auth rejects it
      authMock.mocks.signInSocial.mockRejectedValue({status: 401, message: 'Invalid ID token'})
      event.body = JSON.stringify({idToken: ''})
      const output = await handler(event, context)
      // Better Auth rejects empty token with 401
      expect(output.statusCode).toEqual(401)
    })

    test('should handle expired ID token from Apple', async () => {
      authMock.mocks.signInSocial.mockRejectedValue({status: 401, message: 'Token has expired'})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
      const body = JSON.parse(output.body)
      expect(body.error).toBeDefined()
    })

    test('should handle session creation failure after successful auth', async () => {
      // Simulate auth succeeding but session creation failing
      authMock.mocks.signInSocial.mockRejectedValue({status: 500, message: 'Session creation failed'})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
    })

    test('should handle Better Auth returning redirect response unexpectedly', async () => {
      // This tests the redirect guard in the handler - cast to unknown to simulate unexpected response shape
      authMock.mocks.signInSocial.mockResolvedValue({url: 'https://example.com/redirect', redirect: true} as unknown as Awaited<
        ReturnType<typeof authMock.mocks.signInSocial>
      >)
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error).toBeDefined()
    })
  })
})
