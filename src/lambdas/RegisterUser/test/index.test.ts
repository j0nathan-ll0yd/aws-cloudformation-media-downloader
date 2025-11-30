import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {APIGatewayEvent} from 'aws-lambda'
import {testContext} from '../../../util/jest-setup'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
import {createBetterAuthMock} from '../../../../test/helpers/better-auth-mock'
import {v4 as uuidv4} from 'uuid'

// Mock Better Auth API
const authMock = createBetterAuthMock()
jest.unstable_mockModule('../../../lib/vendor/BetterAuth/config', () => ({auth: authMock.auth}))

// Mock Users entity for name updates
const usersMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/Users', () => ({Users: usersMock.entity}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#RegisterUser', () => {
  let event: APIGatewayEvent
  const context = testContext

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    authMock.mocks.signInSocial.mockReset()
    usersMock.mocks.update.set.mockClear()
    usersMock.mocks.update.go.mockClear()
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
    usersMock.mocks.update.set.mockReturnThis()
    usersMock.mocks.update.go.mockResolvedValue({data: {}})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(typeof body.body.token).toEqual('string')
    expect(typeof body.body.expiresAt).toEqual('number')
    expect(typeof body.body.sessionId).toEqual('string')
    expect(typeof body.body.userId).toEqual('string')

    // Verify Better Auth API was called with correct parameters (using idToken, not accessToken)
    expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({provider: 'apple', idToken: expect.objectContaining({token: expect.any(String)})})
      })
    )

    // Verify name was updated for new user
    expect(usersMock.mocks.update.set).toHaveBeenCalledWith({firstName: 'Jonathan', lastName: 'Lloyd'})
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
    expect(usersMock.mocks.update.set).not.toHaveBeenCalled()
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
