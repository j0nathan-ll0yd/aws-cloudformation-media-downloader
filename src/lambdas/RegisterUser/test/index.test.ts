import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import type {MockedFunction} from 'jest-mock'
import {testContext} from '../../../util/jest-setup'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
import {v4 as uuidv4} from 'uuid'

const {default: validateAuthResponse} = await import('./fixtures/validateAuthCodeForToken-200-OK.json', {assert: {type: 'json'}})
const {default: verifyAppleResponse} = await import('./fixtures/verifyAppleToken-200-OK.json', {assert: {type: 'json'}})

jest.unstable_mockModule('../../../util/secretsmanager-helpers', () => ({
  validateAuthCodeForToken: jest.fn().mockReturnValue(validateAuthResponse),
  verifyAppleToken: jest.fn().mockReturnValue(verifyAppleResponse)
}))

const usersMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/Users', () => ({
  Users: usersMock.entity
}))

const accountsMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/Accounts', () => ({
  Accounts: accountsMock.entity
}))

// Manually add byProvider query mock with proper typing
const byProviderGoMock = jest.fn() as MockedFunction<() => Promise<{data: any[]}>>
;(accountsMock.entity.query as any).byProvider = jest.fn(() => ({
  go: byProviderGoMock
}))

const {default: getUsersByAppleDeviceIdentifierResponse} = await import('./fixtures/getUsersByAppleDeviceIdentifier-200-OK.json', {assert: {type: 'json'}})
const getUsersByAppleDeviceIdentifierMock = jest.fn() as MockedFunction<() => any>
jest.unstable_mockModule('../../../util/shared', () => ({
  getUsersByAppleDeviceIdentifier: getUsersByAppleDeviceIdentifierMock
}))

// Mock Better Auth helpers with proper typing
const createUserSessionMock = jest.fn() as MockedFunction<(userId: string, deviceId?: string, ipAddress?: string, userAgent?: string) => Promise<{token: string; expiresAt: number; sessionId: string; userId?: string}>>
jest.unstable_mockModule('../../../util/better-auth-helpers', () => ({
  createUserSession: createUserSessionMock
}))

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#RegisterUser', () => {
  const event = JSON.parse(JSON.stringify(eventMock))
  const context = testContext
  beforeEach(() => {
    getUsersByAppleDeviceIdentifierMock.mockReturnValue(getUsersByAppleDeviceIdentifierResponse)
    createUserSessionMock.mockReset()
    usersMock.mocks.create.mockClear()
    ;((accountsMock.entity.query as any).byProvider as jest.Mock).mockClear()
    byProviderGoMock.mockClear()
    accountsMock.mocks.create.mockClear()
    accountsMock.mocks.update.go.mockClear()
    accountsMock.mocks.update.set.mockClear()
  })
  test('should successfully register a user, if they dont exist', async () => {
    getUsersByAppleDeviceIdentifierMock.mockReturnValue([])

    // Mock Users.create
    usersMock.mocks.create.mockResolvedValue({data: {userId: uuidv4()}})

    // Mock no existing Apple accounts
    byProviderGoMock.mockResolvedValue({data: []})

    // Mock Accounts.create
    accountsMock.mocks.create.mockResolvedValue({data: {accountId: uuidv4()}})

    // Mock session creation
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
  test('should successfully login a user, if they do exist', async () => {
    // Mock existing Apple account
    byProviderGoMock.mockResolvedValue({
      data: [{accountId: uuidv4(), userId: 'existing-user'}]
    })

    // Mock account update
    accountsMock.mocks.update.set.mockReturnThis()
    accountsMock.mocks.update.go.mockResolvedValue({data: {accountId: uuidv4()}})

    // Mock session creation
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
  test('should handle an invalid payload', async () => {
    event.body = ''
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
  })
})
