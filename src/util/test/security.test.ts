import {describe, expect, it} from '@jest/globals'
import {sanitizeData} from '../security'

describe('security', () => {
  describe('sanitizeData', () => {
    it('should redact sensitive fields with case-insensitive matching', () => {
      const data = {
        authorization: 'Bearer secret',
        Authorization: 'Bearer secret2',
        token: 'abc123',
        password: 'mypass',
        apiKey: 'key123',
        secret: 'secretvalue',
        appleDeviceIdentifier: 'device123',
        safeField: 'visible'
      }

      const result = sanitizeData(data) as Record<string, unknown>

      expect(result.authorization).toBe('[REDACTED]')
      expect(result.Authorization).toBe('[REDACTED]')
      expect(result.token).toBe('[REDACTED]')
      expect(result.password).toBe('[REDACTED]')
      expect(result.apiKey).toBe('[REDACTED]')
      expect(result.secret).toBe('[REDACTED]')
      expect(result.appleDeviceIdentifier).toBe('[REDACTED]')
      expect(result.safeField).toBe('visible')
    })

    it('should handle nested objects', () => {
      const data = {
        headers: {Authorization: 'Bearer secret', 'Content-Type': 'application/json'},
        body: {user: {password: 'secret123', email: 'test@example.com', name: 'John Doe'}}
      }

      const result = sanitizeData(data) as Record<string, unknown>
      const headers = result.headers as Record<string, unknown>
      const body = result.body as Record<string, unknown>
      const user = body.user as Record<string, unknown>

      expect(headers.Authorization).toBe('[REDACTED]')
      expect(headers['Content-Type']).toBe('application/json')
      expect(user.password).toBe('[REDACTED]')
      expect(user.email).toBe('[REDACTED]')
      expect(user.name).toBe('John Doe')
    })

    it('should handle arrays', () => {
      const data = {items: [{id: '1', token: 'secret1'}, {id: '2', token: 'secret2'}]}

      const result = sanitizeData(data) as Record<string, unknown>
      const items = result.items as Array<Record<string, unknown>>

      expect(items[0].id).toBe('1')
      expect(items[0].token).toBe('[REDACTED]')
      expect(items[1].id).toBe('2')
      expect(items[1].token).toBe('[REDACTED]')
    })

    it('should handle primitive values', () => {
      expect(sanitizeData('string')).toBe('string')
      expect(sanitizeData(123)).toBe(123)
      expect(sanitizeData(true)).toBe(true)
      expect(sanitizeData(null)).toBe(null)
      expect(sanitizeData(undefined)).toBe(undefined)
    })

    it('should handle empty objects and arrays', () => {
      const emptyObj = sanitizeData({}) as Record<string, unknown>
      const emptyArr = sanitizeData([]) as unknown[]

      expect(Object.keys(emptyObj).length).toBe(0)
      expect(emptyArr.length).toBe(0)
    })

    it('should redact all PII patterns', () => {
      const data = {
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        phone: '555-1234',
        ssn: '123-45-6789',
        creditCard: '4111111111111111',
        deviceToken: 'device-token-123',
        refreshToken: 'refresh-token-123',
        accessToken: 'access-token-123',
        privateKey: 'private-key-123',
        certificate: 'cert-123',
        safeData: 'not-sensitive'
      }

      const result = sanitizeData(data) as Record<string, unknown>

      expect(result.email).toBe('[REDACTED]')
      expect(result.phoneNumber).toBe('[REDACTED]')
      expect(result.phone).toBe('[REDACTED]')
      expect(result.ssn).toBe('[REDACTED]')
      expect(result.creditCard).toBe('[REDACTED]')
      expect(result.deviceToken).toBe('[REDACTED]')
      expect(result.refreshToken).toBe('[REDACTED]')
      expect(result.accessToken).toBe('[REDACTED]')
      expect(result.privateKey).toBe('[REDACTED]')
      expect(result.certificate).toBe('[REDACTED]')
      expect(result.safeData).toBe('not-sensitive')
    })

    it('should handle deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: 'visible'
            }
          }
        }
      }

      const result = sanitizeData(data) as Record<string, unknown>
      const level1 = result.level1 as Record<string, unknown>
      const level2 = level1.level2 as Record<string, unknown>
      const level3 = level2.level3 as Record<string, unknown>

      expect(level3.password).toBe('[REDACTED]')
      expect(level3.data).toBe('visible')
    })

    it('should handle mixed arrays with objects', () => {
      const data = {
        users: [
          {name: 'Alice', email: 'alice@example.com'},
          {name: 'Bob', password: 'secret123'}
        ]
      }

      const result = sanitizeData(data) as Record<string, unknown>
      const users = result.users as Array<Record<string, unknown>>

      expect(users[0].name).toBe('Alice')
      expect(users[0].email).toBe('[REDACTED]')
      expect(users[1].name).toBe('Bob')
      expect(users[1].password).toBe('[REDACTED]')
    })
  })
})
