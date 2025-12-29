import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayEvent} from 'aws-lambda'
import {testContext} from '#util/vitest-setup'
import {createBetterAuthMock} from '#test/helpers/better-auth-mock'
import {v4 as uuidv4} from 'uuid'

// Mock Better Auth API - now exports getAuth as async function
const authMock = createBetterAuthMock()
vi.mock('#lib/vendor/BetterAuth/config', () => ({getAuth: vi.fn(async () => authMock.auth)}))

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({
  updateUser: vi.fn()
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')
import {updateUser} from '#entities/queries'

describe('#RegisterUser', () => {
  let event: APIGatewayEvent
  const context = testContext

  beforeAll(() => {
    process.env.LOG_LEVEL = 'SILENT'
  })

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    authMock.mocks.signInSocial.mockReset()
    vi.mocked(updateUser).mockClear()
    // Default mock - will be overridden in specific tests
    vi.mocked(updateUser).mockResolvedValue({id: 'test-user-id', email: 'test@example.com', emailVerified: false, name: null, image: null, firstName: null, lastName: null, appleDeviceId: null, createdAt: new Date(), updatedAt: new Date()})
  })

  test('should successfully register a new user via Better Auth and update name', async () => {
    // Mock Better Auth creating a new user
    const userId = uuidv4()
    const sessionId = uuidv4()
    const token = uuidv4()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

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
    vi.mocked(updateUser).mockResolvedValue({id: userId, firstName: 'Jonathan', lastName: 'Lloyd'} as ReturnType<typeof updateUser> extends Promise<infer T> ? T : never)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('number')
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')

    // Verify Better Auth API was called with correct parameters (using idToken, not accessToken)
    expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({body: expect.objectContaining({provider: 'apple', idToken: expect.objectContaining({token: expect.any(String)})})})
    )

    // Verify name was updated for new user
    expect(vi.mocked(updateUser)).toHaveBeenCalledWith(userId, {firstName: 'Jonathan', lastName: 'Lloyd'})
  })

  test('should successfully login an existing user via Better Auth without updating name', async () => {
    // Mock Better Auth finding and logging in existing user
    const userId = uuidv4()
    const sessionId = uuidv4()
    const token = uuidv4()
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
    expect(typeof body.body.expiresAt).toEqual('number')
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
})
