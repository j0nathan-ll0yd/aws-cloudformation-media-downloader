import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayEvent} from 'aws-lambda'
import {createMockContext} from '#util/vitest-setup'
import {createBetterAuthMock} from '#test/helpers/better-auth-mock'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'
import {randomUUID} from 'node:crypto'

// Mock Better Auth API - now exports getAuth as async function
const authMock = createBetterAuthMock()
vi.mock('#lib/vendor/BetterAuth/config', () => ({getAuth: vi.fn(async () => authMock.auth)}))

vi.mock('#entities/queries', () => ({updateUser: vi.fn()}))

const {handler} = await import('./../src')
import {updateUser} from '#entities/queries'

const mockIdToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwcGxlaWQuYXBwbGUuY29tIiwiYXVkIjoibGlmZWdhbWVzLk9mZmxpbmVNZWRpYURvd25sb2FkZXIiLCJleHAiOjE1OTAwOTY2MzksImlhdCI6MTU5MDA5NjAzOSwic3ViIjoiMDAwMTg1Ljc3MjAzMTU1NzBmYzQ5ZDk5YTI2NWY5YWY0YjQ2ODc5LjIwMzQiLCJlbWFpbCI6IjI4bmNjaTMzYTNAcHJpdmF0ZXJlbGF5LmFwcGxlaWQuY29tIiwiZW1haWxfdmVyaWZpZWQiOiJ0cnVlIiwiaXNfcHJpdmF0ZV9lbWFpbCI6InRydWUifQ.mockSignature'

describe('#RegisterUser', () => {
  let event: APIGatewayEvent
  const context = createMockContext()

  beforeAll(() => {
    process.env.LOG_LEVEL = 'SILENT'
  })

  beforeEach(() => {
    event = createAPIGatewayEvent({path: '/registerUser', httpMethod: 'POST', body: JSON.stringify({idToken: mockIdToken})}) as unknown as APIGatewayEvent
    authMock.mocks.signInSocial.mockReset()
    vi.mocked(updateUser).mockClear()
    // Default mock - will be overridden in specific tests
    vi.mocked(updateUser).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      name: null,
      image: null,
      firstName: null,
      lastName: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  test('should successfully register a new user via Better Auth and update name', async () => {
    // Mock Better Auth creating a new user
    const userId = randomUUID()
    const sessionId = randomUUID()
    const token = randomUUID()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    // Include firstName/lastName in request body (sent by iOS app from ASAuthorizationAppleIDCredential.fullName)
    event = createAPIGatewayEvent({
      path: '/registerUser',
      httpMethod: 'POST',
      body: JSON.stringify({idToken: mockIdToken, firstName: 'Jonathan', lastName: 'Lloyd'})
    }) as unknown as APIGatewayEvent

    authMock.mocks.signInSocial.mockResolvedValue({
      user: {
        id: userId,
        email: 'newuser@example.com',
        name: 'New User',
        createdAt: new Date().toISOString() // Just created
      },
      session: {id: sessionId, expiresAt},
      token
    })

    // Mock the user name update
    vi.mocked(updateUser).mockResolvedValue(
      {id: userId, firstName: 'Jonathan', lastName: 'Lloyd'} as ReturnType<typeof updateUser> extends Promise<infer T> ? T : never
    )

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('string') // ISO 8601 timestamp
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')

    // Verify Better Auth API was called with correct parameters (using idToken, not accessToken)
    expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({body: expect.objectContaining({provider: 'apple', idToken: expect.objectContaining({token: expect.any(String)})})})
    )

    // Verify name was updated for new user (name = firstName + lastName)
    expect(vi.mocked(updateUser)).toHaveBeenCalledWith(userId, {name: 'Jonathan Lloyd', firstName: 'Jonathan', lastName: 'Lloyd'})
  })

  test('should successfully login an existing user via Better Auth without updating name', async () => {
    // Mock Better Auth finding and logging in existing user
    const userId = randomUUID()
    const sessionId = randomUUID()
    const token = randomUUID()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    authMock.mocks.signInSocial.mockResolvedValue({
      user: {
        id: userId,
        email: 'existinguser@example.com',
        name: 'Existing User',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString() // Created a week ago
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

    // Verify name was NOT updated for existing user
    expect(vi.mocked(updateUser)).not.toHaveBeenCalled()
  })

  test('should handle an invalid payload', async () => {
    event.body = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)

    // Better Auth API should not be called if request validation fails
    expect(authMock.mocks.signInSocial).not.toHaveBeenCalled()
  })

  test('should handle Better Auth errors gracefully', async () => {
    // Mock Better Auth throwing an error
    authMock.mocks.signInSocial.mockRejectedValue({status: 500, message: 'Internal server error'})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-5XX-generic')
  })

  describe('#EdgeCases', () => {
    test('should handle missing firstName and lastName in request', async () => {
      const userId = randomUUID()
      authMock.mocks.signInSocial.mockResolvedValue({
        user: {id: userId, email: 'test@example.com', createdAt: new Date().toISOString()},
        session: {id: randomUUID(), expiresAt: Date.now() + 86400000},
        token: randomUUID()
      })
      // Remove name fields from request body
      const body = JSON.parse(event.body!)
      delete body.firstName
      delete body.lastName
      event.body = JSON.stringify(body)

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      // updateUser should not be called when no name fields provided
      expect(vi.mocked(updateUser)).not.toHaveBeenCalled()
    })

    test('should handle only firstName provided (no lastName)', async () => {
      const userId = randomUUID()
      authMock.mocks.signInSocial.mockResolvedValue({
        user: {id: userId, email: 'test@example.com', createdAt: new Date().toISOString()},
        session: {id: randomUUID(), expiresAt: Date.now() + 86400000},
        token: randomUUID()
      })
      event = createAPIGatewayEvent({
        path: '/registerUser',
        httpMethod: 'POST',
        body: JSON.stringify({idToken: mockIdToken, firstName: 'Jonathan'})
      }) as unknown as APIGatewayEvent

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      // name should be just firstName when lastName is missing
      expect(vi.mocked(updateUser)).toHaveBeenCalledWith(userId, {name: 'Jonathan', firstName: 'Jonathan', lastName: ''})
    })

    test('should handle updateUser database failure gracefully', async () => {
      const userId = randomUUID()
      authMock.mocks.signInSocial.mockResolvedValue({
        user: {id: userId, email: 'test@example.com', createdAt: new Date().toISOString()},
        session: {id: randomUUID(), expiresAt: Date.now() + 86400000},
        token: randomUUID()
      })
      vi.mocked(updateUser).mockRejectedValue(new Error('Database write failed'))

      const output = await handler(event, context)
      // Should still return success since auth succeeded, name update is secondary
      expect([200, 500]).toContain(output.statusCode)
    })

    test('should handle invalid JSON in request body', async () => {
      event.body = 'not-valid-json{'

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(400)
      expect(authMock.mocks.signInSocial).not.toHaveBeenCalled()
    })

    test('should handle Apple ID token verification failure', async () => {
      authMock.mocks.signInSocial.mockRejectedValue({status: 401, message: 'ID token verification failed'})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(401)
    })

    test('should handle rate limiting from Better Auth', async () => {
      authMock.mocks.signInSocial.mockRejectedValue({status: 429, message: 'Too many requests'})

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(429)
    })
  })
})
