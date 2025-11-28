import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import type {MockedFunction} from 'jest-mock'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'

const {default: validateAuthResponse} = await import('./fixtures/validateAuthCodeForToken-200-OK.json', {assert: {type: 'json'}})

// Mock Apple authorization code exchange (still needed before Better Auth call)
jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  validateAuthCodeForToken: jest.fn().mockReturnValue(validateAuthResponse)
}))

// Mock Better Auth API
interface SignInSocialParams {
  headers: Record<string, string>
  body: {
    provider: string
    idToken: {
      token: string
      accessToken?: string
    }
  }
}

const signInSocialMock = jest.fn() as MockedFunction<(params: SignInSocialParams) => Promise<any>>

jest.unstable_mockModule('../../../lib/vendor/BetterAuth/config', () => ({
  auth: {
    api: {
      signInSocial: signInSocialMock
    }
  }
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#RegisterUser', () => {
  let event: any
  const context = testContext

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    signInSocialMock.mockReset()
  })

  test('should successfully register a new user via Better Auth', async () => {
    // Mock Better Auth creating a new user
    const userId = uuidv4()
    const sessionId = uuidv4()
    const token = uuidv4()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    signInSocialMock.mockResolvedValue({
      user: {
        id: userId,
        email: 'newuser@example.com',
        name: 'New User',
        createdAt: new Date().toISOString() // Just created
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

    // Verify Better Auth API was called with correct parameters
    expect(signInSocialMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          provider: 'apple',
          idToken: expect.objectContaining({
            token: expect.any(String),
            accessToken: expect.any(String)
          })
        })
      })
    )
  })

  test('should successfully login an existing user via Better Auth', async () => {
    // Mock Better Auth finding and logging in existing user
    const userId = uuidv4()
    const sessionId = uuidv4()
    const token = uuidv4()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    signInSocialMock.mockResolvedValue({
      user: {
        id: userId,
        email: 'existinguser@example.com',
        name: 'Existing User',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString() // Created a week ago
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
  })

  test('should handle an invalid payload', async () => {
    event.body = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)

    // Better Auth API should not be called if request validation fails
    expect(signInSocialMock).not.toHaveBeenCalled()
  })

  test('should handle Better Auth errors gracefully', async () => {
    // Mock Better Auth throwing an error
    signInSocialMock.mockRejectedValue({
      status: 500,
      message: 'Internal server error'
    })

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-5XX-generic')
  })
})
