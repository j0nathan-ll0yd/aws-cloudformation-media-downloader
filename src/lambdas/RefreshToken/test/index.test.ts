import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayProxyEvent} from 'aws-lambda'
import {testContext} from '#util/vitest-setup'
import {createAPIGatewayEvent} from '#test/helpers/event-factories'
import {DEFAULT_SESSION_ID, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import type {SessionPayload} from '#types/util'

const validateSessionTokenMock = vi.fn<(token: string) => Promise<SessionPayload>>()
const refreshSessionMock = vi.fn<(sessionId: string) => Promise<{expiresAt: number}>>()
vi.mock('#lib/domain/auth/sessionService', () => ({
  validateSessionToken: validateSessionTokenMock, // fmt: multiline
  refreshSession: refreshSessionMock
}))

const {handler} = await import('./../src')

describe('#RefreshToken', () => {
  const context = testContext
  let event: APIGatewayProxyEvent
  const fakeUserId = DEFAULT_USER_ID
  const fakeSessionId = DEFAULT_SESSION_ID
  const fakeToken = 'test-session-token-abc123'
  const futureExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

  beforeEach(() => {
    vi.clearAllMocks()
    event = createAPIGatewayEvent({
      path: '/refreshToken',
      httpMethod: 'POST',
      headers: {Authorization: `Bearer ${fakeToken}`}
    }) as unknown as APIGatewayProxyEvent
  })

  test('should successfully refresh a valid session token', async () => {
    validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
    refreshSessionMock.mockResolvedValue({expiresAt: futureExpiresAt})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    const body = JSON.parse(output.body)
    expect(body.body.token).toEqual(fakeToken)
    expect(typeof body.body.expiresAt).toEqual('string') // ISO 8601 timestamp
    expect(body.body.sessionId).toEqual(fakeSessionId)
    expect(body.body.userId).toEqual(fakeUserId)

    expect(validateSessionTokenMock).toHaveBeenCalledWith(fakeToken)
    expect(refreshSessionMock).toHaveBeenCalledWith(fakeSessionId)
  })

  test('should return 401 when Authorization header is missing', async () => {
    delete event.headers!['Authorization']

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('UNAUTHORIZED')
    expect(body.error.message).toEqual('Missing Authorization header')

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
    expect(refreshSessionMock).not.toHaveBeenCalled()
  })

  test('should return 401 when Authorization header format is invalid', async () => {
    event.headers!['Authorization'] = 'InvalidFormat token123'

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('UNAUTHORIZED')
    expect(body.error.message).toEqual('Invalid Authorization header format')

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
  })

  test('should return 401 when Authorization header has no Bearer prefix', async () => {
    event.headers!['Authorization'] = 'token123'

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)

    expect(validateSessionTokenMock).not.toHaveBeenCalled()
  })

  test('should handle lowercase authorization header', async () => {
    delete event.headers!['Authorization']
    event.headers!['authorization'] = `Bearer ${fakeToken}`

    validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
    refreshSessionMock.mockResolvedValue({expiresAt: futureExpiresAt})

    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)

    expect(validateSessionTokenMock).toHaveBeenCalledWith(fakeToken)
  })

  describe('#SessionValidation', () => {
    test('should return error when session token is invalid', async () => {
      validateSessionTokenMock.mockRejectedValue(new Error('Invalid session token'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')
    })

    test('should return error when session is expired', async () => {
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
    })
  })

  describe('#RefreshFailure', () => {
    test('should return error when refresh operation fails', async () => {
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: fakeSessionId, expiresAt: Date.now() + 1000000})
      refreshSessionMock.mockRejectedValue(new Error('DynamoDB connection failed'))

      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)

      const body = JSON.parse(output.body)
      expect(body.error.code).toEqual('custom-5XX-generic')
    })
  })
})
