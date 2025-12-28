/**
 * Device Management E2E Test Scenario
 *
 * Tests device registration, token updates, and the device pruning lifecycle.
 * Validates multi-device scenarios and push notification setup.
 */

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {ApiClient, AuthClient, createDevicePool, DeviceSimulator, generateMockDevice, generateMockDeviceToken} from '../client/index.js'

describe('Device Management E2E', () => {
  let apiClient: ApiClient
  let authClient: AuthClient

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(async () => {
    apiClient = new ApiClient({baseUrl, apiKey})
    authClient = new AuthClient(apiClient)

    // Register test user
    await authClient.register({firstName: 'Device', lastName: 'Manager'})
  })

  afterAll(async () => {
    if (authClient.isAuthenticated()) {
      try {
        await authClient.deleteAccount()
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('Single Device Registration', () => {
    let deviceSimulator: DeviceSimulator

    it('should register a new device', async () => {
      const device = generateMockDevice({deviceId: 'single-device-test', name: 'Single Device Test iPhone'})
      deviceSimulator = new DeviceSimulator(apiClient, device)

      const result = await deviceSimulator.register()

      expect(result.endpointArn).toBeDefined()
      expect(result.endpointArn).toMatch(/^arn:aws:sns:/)
      expect(deviceSimulator.getEndpointArn()).toBe(result.endpointArn)
    })

    it('should update device on re-registration with same ID', async () => {
      const result = await deviceSimulator.register()

      expect(result.endpointArn).toBeDefined()
    })

    it('should handle token refresh', async () => {
      const originalToken = deviceSimulator.getDevice().token
      const result = await deviceSimulator.updateToken()

      expect(result.endpointArn).toBeDefined()
      expect(deviceSimulator.getDevice().token).not.toBe(originalToken)
    })

    it('should send various device events', async () => {
      // All should succeed without throwing
      await deviceSimulator.sendAppLaunchEvent()
      await deviceSimulator.sendBackgroundRefreshEvent()
      await deviceSimulator.sendPushReceivedEvent('test-notification')
      await deviceSimulator.sendDownloadStartedEvent('test-file')
      await deviceSimulator.sendPlaybackEvent('test-file', 120)
    })
  })

  describe('Multi-Device Registration', () => {
    let devices: DeviceSimulator[]

    beforeAll(() => {
      devices = createDevicePool(apiClient, 3)
    })

    it('should register multiple devices for the same user', async () => {
      const registrationPromises = devices.map((device) => device.register())
      const results = await Promise.all(registrationPromises)

      // All devices should have unique endpoint ARNs
      const arns = results.map((r) => r.endpointArn)
      const uniqueArns = new Set(arns)

      expect(uniqueArns.size).toBe(devices.length)
      results.forEach((result) => {
        expect(result.endpointArn).toMatch(/^arn:aws:sns:/)
      })
    })

    it('should send events from all devices', async () => {
      const eventPromises = devices.map((device) => device.sendAppLaunchEvent())
      await Promise.all(eventPromises)
      // No error means success
    })
  })

  describe('Device Validation', () => {
    it('should reject device registration with missing required fields', async () => {
      const response = await apiClient.post('/device/register', {
        deviceId: 'incomplete-device'
        // Missing: name, systemName, systemVersion, token
      })

      expect(response.status).toBe(400)
    })

    it('should reject device registration with invalid token format', async () => {
      const response = await apiClient.post('/device/register', {
        deviceId: 'invalid-token-device',
        name: 'Invalid Token Device',
        systemName: 'iOS',
        systemVersion: '17.0',
        token: '' // Empty token
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Push Notification Subscription', () => {
    let deviceSimulator: DeviceSimulator
    const testTopicArn = 'arn:aws:sns:us-west-2:000000000000:test-push-notifications'

    beforeAll(async () => {
      const device = generateMockDevice({deviceId: 'subscription-test-device', name: 'Subscription Test iPhone'})
      deviceSimulator = new DeviceSimulator(apiClient, device)
      await deviceSimulator.register()
    })

    it('should subscribe device to push notification topic', async () => {
      const result = await deviceSimulator.subscribeToNotifications(testTopicArn)

      expect(result.subscriptionArn).toBeDefined()
      expect(result.subscriptionArn).toMatch(/^arn:aws:sns:/)
    })

    it('should handle duplicate subscription gracefully', async () => {
      // Second subscription to same topic should either succeed or return existing
      const result = await deviceSimulator.subscribeToNotifications(testTopicArn)

      expect(result.subscriptionArn).toBeDefined()
    })
  })
})

describe('Anonymous Device Registration', () => {
  let apiClient: ApiClient

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(() => {
    apiClient = new ApiClient({baseUrl, apiKey})
    // No auth token - anonymous access
  })

  it('should allow anonymous device registration', async () => {
    const device = generateMockDevice({deviceId: 'anonymous-device-management-test', name: 'Anonymous Device'})
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    const result = await deviceSimulator.register()

    expect(result.endpointArn).toBeDefined()
  })

  it('should allow anonymous device events', async () => {
    const device = generateMockDevice({deviceId: 'anonymous-events-test', name: 'Anonymous Events Device'})
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    // Should not throw
    await deviceSimulator.sendAppLaunchEvent()
  })

  it('should not allow anonymous subscription to topics', async () => {
    const device = generateMockDevice({deviceId: 'anonymous-subscribe-test', name: 'Anonymous Subscribe Device'})
    const deviceSimulator = new DeviceSimulator(apiClient, device)
    await deviceSimulator.register()

    // Subscription requires authentication
    const response = await apiClient.post('/user/subscribe', {
      endpointArn: deviceSimulator.getEndpointArn(),
      topicArn: 'arn:aws:sns:us-west-2:000000000000:test-topic'
    })

    // Should fail for anonymous users
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

describe('Device Token Edge Cases', () => {
  let apiClient: ApiClient
  let authClient: AuthClient

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(async () => {
    apiClient = new ApiClient({baseUrl, apiKey})
    authClient = new AuthClient(apiClient)
    await authClient.register({firstName: 'Token', lastName: 'Tester'})
  })

  afterAll(async () => {
    if (authClient.isAuthenticated()) {
      try {
        await authClient.deleteAccount()
      } catch {
        // Ignore
      }
    }
  })

  it('should handle very long device tokens', async () => {
    const longToken = generateMockDeviceToken() + generateMockDeviceToken() // 128 hex chars
    const device = generateMockDevice({deviceId: 'long-token-device', token: longToken})
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    const result = await deviceSimulator.register()

    expect(result.endpointArn).toBeDefined()
  })

  it('should handle rapid token updates', async () => {
    const device = generateMockDevice({deviceId: 'rapid-update-device'})
    const deviceSimulator = new DeviceSimulator(apiClient, device)

    // Initial registration
    await deviceSimulator.register()

    // Rapid updates
    const updates = []
    for (let i = 0; i < 5; i++) {
      updates.push(deviceSimulator.updateToken())
    }

    const results = await Promise.allSettled(updates)
    const successful = results.filter((r) => r.status === 'fulfilled')

    // At least some should succeed
    expect(successful.length).toBeGreaterThan(0)
  })
})
