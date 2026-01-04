import {describe, expect, it} from 'vitest'
import {UnauthorizedError} from '#lib/system/errors'
import {extractBearerToken, extractBearerTokenOptional, hasAuthorizationHeader, isValidBearerFormat} from '../auth-helpers'

describe('auth-helpers', () => {
  describe('extractBearerToken', () => {
    it('should extract token from Authorization header', () => {
      const headers = {Authorization: 'Bearer abc123'}

      const token = extractBearerToken(headers)

      expect(token).toBe('abc123')
    })

    it('should extract token from lowercase authorization header', () => {
      const headers = {authorization: 'Bearer xyz789'}

      const token = extractBearerToken(headers)

      expect(token).toBe('xyz789')
    })

    it('should prefer Authorization over authorization', () => {
      const headers = {Authorization: 'Bearer token1', authorization: 'Bearer token2'}

      const token = extractBearerToken(headers)

      expect(token).toBe('token1')
    })

    it('should handle JWT tokens with dots', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const headers = {Authorization: `Bearer ${jwt}`}

      const token = extractBearerToken(headers)

      expect(token).toBe(jwt)
    })

    it('should handle tokens with hyphens and underscores', () => {
      const headers = {Authorization: 'Bearer test-token_123'}

      const token = extractBearerToken(headers)

      expect(token).toBe('test-token_123')
    })

    it('should throw UnauthorizedError when header is missing', () => {
      const headers = {}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
      expect(() => extractBearerToken(headers)).toThrow('Missing Authorization header')
    })

    it('should throw UnauthorizedError when header is undefined', () => {
      const headers = {Authorization: undefined}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError when header is empty string', () => {
      const headers = {Authorization: ''}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError when not Bearer format', () => {
      const headers = {Authorization: 'Basic abc123'}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
      expect(() => extractBearerToken(headers)).toThrow('Invalid Authorization header format')
    })

    it('should throw UnauthorizedError when Bearer has no token', () => {
      const headers = {Authorization: 'Bearer '}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError when only Bearer keyword', () => {
      const headers = {Authorization: 'Bearer'}

      expect(() => extractBearerToken(headers)).toThrow(UnauthorizedError)
    })

    it('should be case-insensitive for Bearer keyword', () => {
      expect(extractBearerToken({Authorization: 'bearer token1'})).toBe('token1')
      expect(extractBearerToken({Authorization: 'BEARER token2'})).toBe('token2')
      expect(extractBearerToken({Authorization: 'BeArEr token3'})).toBe('token3')
    })
  })

  describe('extractBearerTokenOptional', () => {
    it('should extract token when present', () => {
      const headers = {Authorization: 'Bearer abc123'}

      const token = extractBearerTokenOptional(headers)

      expect(token).toBe('abc123')
    })

    it('should return null when header is missing', () => {
      const headers = {}

      const token = extractBearerTokenOptional(headers)

      expect(token).toBeNull()
    })

    it('should return null when header is empty', () => {
      const headers = {Authorization: ''}

      const token = extractBearerTokenOptional(headers)

      expect(token).toBeNull()
    })

    it('should return null when not Bearer format', () => {
      const headers = {Authorization: 'Basic abc123'}

      const token = extractBearerTokenOptional(headers)

      expect(token).toBeNull()
    })

    it('should return null when Bearer has no token', () => {
      const headers = {Authorization: 'Bearer '}

      const token = extractBearerTokenOptional(headers)

      expect(token).toBeNull()
    })
  })

  describe('isValidBearerFormat', () => {
    it('should return true for valid Bearer format', () => {
      expect(isValidBearerFormat('Bearer abc123')).toBe(true)
      expect(isValidBearerFormat('Bearer test-token')).toBe(true)
      expect(isValidBearerFormat('Bearer test_token')).toBe(true)
      expect(isValidBearerFormat('Bearer test.token.jwt')).toBe(true)
      expect(isValidBearerFormat('Bearer test=token')).toBe(true)
    })

    it('should return true for case-insensitive Bearer', () => {
      expect(isValidBearerFormat('bearer token')).toBe(true)
      expect(isValidBearerFormat('BEARER TOKEN')).toBe(true)
    })

    it('should return false for invalid formats', () => {
      expect(isValidBearerFormat('Basic abc123')).toBe(false)
      expect(isValidBearerFormat('Bearer')).toBe(false)
      expect(isValidBearerFormat('Bearer ')).toBe(false)
      expect(isValidBearerFormat('')).toBe(false)
      expect(isValidBearerFormat('abc123')).toBe(false)
    })

    it('should return false for tokens with invalid characters', () => {
      expect(isValidBearerFormat('Bearer token!@#$')).toBe(false)
      expect(isValidBearerFormat('Bearer token space')).toBe(false)
    })
  })

  describe('hasAuthorizationHeader', () => {
    it('should return true when Authorization header exists', () => {
      expect(hasAuthorizationHeader({Authorization: 'Bearer token'})).toBe(true)
      expect(hasAuthorizationHeader({authorization: 'Bearer token'})).toBe(true)
    })

    it('should return false when header is missing', () => {
      expect(hasAuthorizationHeader({})).toBe(false)
    })

    it('should return false when header is undefined', () => {
      expect(hasAuthorizationHeader({Authorization: undefined})).toBe(false)
    })

    it('should return false when header is empty string', () => {
      expect(hasAuthorizationHeader({Authorization: ''})).toBe(false)
    })
  })
})
