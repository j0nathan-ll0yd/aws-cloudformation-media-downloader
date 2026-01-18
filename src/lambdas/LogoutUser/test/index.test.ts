import {beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'
import {DEFAULT_SESSION_ID, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import type {SessionPayload} from '#types/util'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'

const validateSessionTokenMock = vi.fn<(token: string) => Promise<SessionPayload>>()
vi.mock('#lib/domain/auth/sessionService', () => ({validateSessionToken: validateSessionTokenMock}))

const deleteSessionMock = vi.fn<(sessionId: string) => Promise<void>>()
vi.mock('#entities/queries', () => ({deleteSession: deleteSessionMock}))

const {handler} = await import('./../src')

describe('#LogoutUser', () => {
  const context = createMockContext()
  let event: CustomAPIGatewayRequestAuthorizerEvent
  const fakeUserId = DEFAULT_USER_ID
  const fakeSessionId = DEFAULT_SESSION_ID
  const fakeToken = 'test-session-token-abc123'

  beforeEach(() => {
    vi.clearAllMocks()
    event = createAPIGatewayEvent({path: '/user/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${fakeToken}`}})
  })

  test('should successfully logout with valid session token', async () => {
    validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
    deleteSessionMock.mockResolvedValue(undefined)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)
    expect(output.body).toEqual('')

    expect(validateSessionTokenMock).toHaveBeenCalledWith(fakeToken)
    expect(deleteSessionMock).toHaveBeenCalledWith(fakeSessionId)
  })

  test('should return 401 when Authorization header is missing', async () => {
    delete event.headers!['Authorization']

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('UNAUTHORIZED')
    expect(body.error.message).toEqual('Missing Authorization header')

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
    expect(deleteSessionMock).not.toHaveBeenCalled()
  })

  test('should return 401 when Authorization header format is invalid', async () => {
    event.headers!['Authorization'] = 'InvalidFormat token123'

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('UNAUTHORIZED')
    expect(body.error.message).toEqual('Invalid Authorization header format')

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
    expect(deleteSessionMock).not.toHaveBeenCalled()
  })

  test('should return 401 when Authorization header has no Bearer prefix', async () => {
    event.headers!['Authorization'] = 'token123'

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
    expect(deleteSessionMock).not.toHaveBeenCalled()
  })

  test('should handle lowercase authorization header', async () => {
    delete event.headers!['Authorization']
    event.headers!['authorization'] = `Bearer ${fakeToken}`

    validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
    deleteSessionMock.mockResolvedValue(undefined)

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(204)

    expect(validateSessionTokenMock).toHaveBeenCalledWith(fakeToken)
    expect(deleteSessionMock).toHaveBeenCalledWith(fakeSessionId)
  })

  describe('#SessionValidation', () => {
    test('should return error when session token is invalid', async () => {
      validateSessionTokenMock.mockRejectedValue(new Error('Invalid session token'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')

      expect(deleteSessionMock).not.toHaveBeenCalled()
    })

    test('should return error when session is expired', async () => {
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))

      expect(deleteSessionMock).not.toHaveBeenCalled()
    })
  })

  describe('#DeleteFailure', () => {
    test('should return error when delete operation fails', async () => {
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
      deleteSessionMock.mockRejectedValue(new Error('Database connection failed'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')
    })
  })
})
