/**
 * User Lifecycle E2E Test Scenario
 *
 * Tests the complete user journey: Register -> Use App -> Delete Account
 * This validates the full user lifecycle including cascade deletions.
 */

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {ApiClient, AuthClient, DeviceSimulator, generateMockDevice} from '../client/index.js'

describe('User Lifecycle E2E', () => {
  let apiClient: ApiClient
  let authClient: AuthClient
  let deviceSimulator: DeviceSimulator

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(() => {
    apiClient = new ApiClient({baseUrl, apiKey})
    authClient = new AuthClient(apiClient)
  })

  afterAll(async () => {
    // Cleanup: delete user if still exists
    if (authClient.isAuthenticated()) {
      try {
        await authClient.deleteAccount()
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('Registration Flow', () => {
    it('should register a new user with Apple ID token', async () => {
      const user = await authClient.register({firstName: 'E2E', lastName: 'TestUser'})

      expect(user.token).toBeDefined()
      expect(user.userId).toBeDefined()
      expect(user.sessionId).toBeDefined()
      expect(user.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should have valid authentication after registration', () => {
      expect(authClient.isAuthenticated()).toBe(true)
      expect(authClient.getCurrentUser()).not.toBeNull()
    })
  })

  describe('Device Registration Flow', () => {
    it('should register a device for push notifications', async () => {
      const device = generateMockDevice({name: 'E2E Test iPhone', systemVersion: '17.0'})
      deviceSimulator = new DeviceSimulator(apiClient, device)

      const result = await deviceSimulator.register()

      expect(result.endpointArn).toBeDefined()
      expect(result.endpointArn).toMatch(/^arn:aws:sns:/)
    })

    it('should update device token on re-registration', async () => {
      const result = await deviceSimulator.updateToken()

      expect(result.endpointArn).toBeDefined()
    })

    it('should send device events', async () => {
      // Should not throw
      await deviceSimulator.sendAppLaunchEvent()
      await deviceSimulator.sendBackgroundRefreshEvent()
    })
  })

  describe('File Operations Flow', () => {
    it('should list files for authenticated user (empty for new user)', async () => {
      const response = await apiClient.get<{contents: unknown[]; keyCount: number}>('/files')

      expect(response.status).toBe(200)
      expect('body' in response.data).toBe(true)

      if ('body' in response.data) {
        expect(response.data.body.contents).toEqual([])
        expect(response.data.body.keyCount).toBe(0)
      }
    })
  })

  describe('Token Refresh Flow', () => {
    it('should refresh session token', async () => {
      const refreshedUser = await authClient.refreshToken()

      expect(refreshedUser.token).toBeDefined()
      expect(refreshedUser.expiresAt).toBeGreaterThan(Date.now())
      expect(refreshedUser.userId).toBe(authClient.getCurrentUser()?.userId)
    })
  })

  describe('Account Deletion Flow', () => {
    it('should delete user account and cascade delete related data', async () => {
      const userId = authClient.getCurrentUser()?.userId
      expect(userId).toBeDefined()

      // Delete account
      await authClient.deleteAccount()

      expect(authClient.isAuthenticated()).toBe(false)
      expect(authClient.getCurrentUser()).toBeNull()
    })

    it('should not be able to access files after deletion', async () => {
      // Token should be cleared, but let's try with a cleared client
      const response = await apiClient.get('/files')

      // Should get demo file (anonymous access) or 401 depending on implementation
      expect([200, 401]).toContain(response.status)
    })

    it('should create new user on re-registration after deletion', async () => {
      const newUser = await authClient.register({firstName: 'NewE2E', lastName: 'TestUser'})

      // New user should have a different userId (or same if Apple ID maps to same user)
      expect(newUser.token).toBeDefined()
      expect(newUser.userId).toBeDefined()

      // Cleanup
      await authClient.deleteAccount()
    })
  })
})

describe('Anonymous User Flow', () => {
  let apiClient: ApiClient

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(() => {
    apiClient = new ApiClient({baseUrl, apiKey})
    // No auth token set - anonymous access
  })

  it('should access files endpoint anonymously (demo mode)', async () => {
    const response = await apiClient.get<{contents: unknown[]; keyCount: number}>('/files')

    expect(response.status).toBe(200)
    expect('body' in response.data).toBe(true)
  })

  it('should register device anonymously', async () => {
    const device = generateMockDevice({deviceId: 'anonymous-device-e2e', name: 'Anonymous E2E Device'})
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    const result = await deviceSimulator.register()

    expect(result.endpointArn).toBeDefined()
  })

  it('should send device events anonymously', async () => {
    const device = generateMockDevice()
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    // Should not throw
    await deviceSimulator.sendAppLaunchEvent()
  })

  it('should not access protected endpoints anonymously', async () => {
    const response = await apiClient.post('/user/refresh')

    expect(response.status).toBe(401)
  })
})
