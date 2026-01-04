import {describe, expect, it, vi} from 'vitest'
import {
  assertTokenResponse,
  type BetterAuthOAuthResponse,
  type BetterAuthRedirectResponse,
  type BetterAuthTokenResponse,
  getSessionExpirationISO,
  getSessionExpirationMs,
  isRedirectResponse,
  isTokenResponse
} from '../helpers'

describe('BetterAuth helpers', () => {
  const mockTokenResponse: BetterAuthTokenResponse = {
    redirect: false,
    token: 'test-session-token',
    url: undefined,
    user: {id: 'user-123', email: 'test@example.com', name: 'Test User', createdAt: new Date('2024-01-01')},
    session: {
      id: 'session-456',
      expiresAt: Date.now() + 86400000 // 24 hours from now
    }
  }

  const mockRedirectResponse: BetterAuthRedirectResponse = {redirect: true, url: 'https://appleid.apple.com/auth/authorize?client_id=...'}

  describe('isRedirectResponse', () => {
    it('should return true for redirect response', () => {
      expect(isRedirectResponse(mockRedirectResponse)).toBe(true)
    })

    it('should return false for token response', () => {
      expect(isRedirectResponse(mockTokenResponse)).toBe(false)
    })

    it('should return false when url is empty string', () => {
      const response = {...mockRedirectResponse, url: ''} as BetterAuthOAuthResponse
      expect(isRedirectResponse(response)).toBe(false)
    })

    it('should return false when url is undefined', () => {
      const response = {...mockTokenResponse} as BetterAuthOAuthResponse
      expect(isRedirectResponse(response)).toBe(false)
    })
  })

  describe('isTokenResponse', () => {
    it('should return true for token response', () => {
      expect(isTokenResponse(mockTokenResponse)).toBe(true)
    })

    it('should return false for redirect response', () => {
      expect(isTokenResponse(mockRedirectResponse)).toBe(false)
    })

    it('should return false when token is empty', () => {
      const response = {...mockTokenResponse, token: ''} as BetterAuthOAuthResponse
      expect(isTokenResponse(response)).toBe(false)
    })
  })

  describe('assertTokenResponse', () => {
    it('should return token response when not a redirect', () => {
      const result = assertTokenResponse(mockTokenResponse)

      expect(result.token).toBe('test-session-token')
      expect(result.user.id).toBe('user-123')
      expect(result.session?.id).toBe('session-456')
    })

    it('should throw error for redirect response', () => {
      expect(() => assertTokenResponse(mockRedirectResponse)).toThrow('Unexpected redirect response from Better Auth')
    })

    it('should handle token response without session', () => {
      const responseWithoutSession = {...mockTokenResponse, session: undefined}

      const result = assertTokenResponse(responseWithoutSession)

      expect(result.token).toBe('test-session-token')
      expect(result.session).toBeUndefined()
    })
  })

  describe('getSessionExpirationMs', () => {
    it('should return session expiresAt when provided', () => {
      const expiresAt = Date.now() + 86400000
      const session = {id: 'session-1', expiresAt}

      const result = getSessionExpirationMs(session)

      expect(result).toBe(expiresAt)
    })

    it('should return 30 days from now when session is undefined', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const result = getSessionExpirationMs(undefined)

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      expect(result).toBe(now + thirtyDaysMs)

      vi.useRealTimers()
    })

    it('should return 30 days from now when expiresAt is 0', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const result = getSessionExpirationMs({id: 'session-1', expiresAt: 0})

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      expect(result).toBe(now + thirtyDaysMs)

      vi.useRealTimers()
    })
  })

  describe('getSessionExpirationISO', () => {
    it('should return ISO string for session expiration', () => {
      const expiresAt = new Date('2024-06-15T12:00:00Z').getTime()
      const session = {id: 'session-1', expiresAt}

      const result = getSessionExpirationISO(session)

      expect(result).toBe('2024-06-15T12:00:00.000Z')
    })

    it('should return valid ISO string when session is undefined', () => {
      const result = getSessionExpirationISO(undefined)

      // Should be a valid ISO date string
      expect(new Date(result).toISOString()).toBe(result)
    })

    it('should return future date when session is undefined', () => {
      const result = getSessionExpirationISO(undefined)
      const resultDate = new Date(result)

      // Should be in the future
      expect(resultDate.getTime()).toBeGreaterThan(Date.now())
    })
  })
})
