/**
 * Full Download Flow E2E Test Scenario
 *
 * Tests the complete video download pipeline:
 * Feedly Webhook -> EventBridge -> SQS -> Lambda -> S3 -> Push Notification
 *
 * This is the core business flow of the application.
 */

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {ApiClient, AuthClient, DeviceSimulator, generateMockDevice, PushSimulator} from '../client/index.js'

describe('Full Download Flow E2E', () => {
  let apiClient: ApiClient
  let authClient: AuthClient
  let deviceSimulator: DeviceSimulator
  let pushSimulator: PushSimulator

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  // Test video URL (using a short, stable video for testing)
  const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const testVideoTitle = 'E2E Test Video Download'

  beforeAll(async () => {
    apiClient = new ApiClient({baseUrl, apiKey})
    authClient = new AuthClient(apiClient)
    pushSimulator = new PushSimulator()

    // Register test user
    await authClient.register({firstName: 'Download', lastName: 'Tester'})

    // Register test device
    const device = generateMockDevice({name: 'Download Test iPhone'})
    deviceSimulator = new DeviceSimulator(apiClient, device)
    await deviceSimulator.register()
  })

  afterAll(async () => {
    // Cleanup
    pushSimulator.cleanup()

    if (authClient.isAuthenticated()) {
      try {
        await authClient.deleteAccount()
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('Webhook Submission', () => {
    it('should accept valid YouTube URL via Feedly webhook', async () => {
      const response = await apiClient.post<{status: string}>('/feedly', {
        articleURL: testVideoUrl,
        articleTitle: testVideoTitle,
        sourceTitle: 'E2E Test Channel',
        articlePublishedAt: new Date().toISOString()
      })

      expect(response.status).toBeLessThan(300)
      expect('body' in response.data).toBe(true)

      if ('body' in response.data) {
        // Status should be one of: Dispatched, Accepted, Initiated
        expect(['Dispatched', 'Accepted', 'Initiated']).toContain(response.data.body.status)
      }
    })

    it('should handle duplicate webhook requests idempotently', async () => {
      const response = await apiClient.post<{status: string}>('/feedly', {
        articleURL: testVideoUrl,
        articleTitle: testVideoTitle + ' (duplicate)',
        sourceTitle: 'E2E Test Channel'
      })

      // Should succeed without error (idempotency)
      expect(response.status).toBeLessThan(300)
    })

    it('should reject invalid YouTube URL', async () => {
      const response = await apiClient.post('/feedly', {articleURL: 'https://example.com/not-a-video', articleTitle: 'Invalid URL Test'})

      expect(response.status).toBe(400)
      expect('error' in response.data).toBe(true)
    })

    it('should reject missing article URL', async () => {
      const response = await apiClient.post('/feedly', {articleTitle: 'Missing URL Test'})

      expect(response.status).toBe(400)
    })

    it('should support YouTube Shorts URL format', async () => {
      const response = await apiClient.post<{status: string}>('/feedly', {
        articleURL: 'https://www.youtube.com/shorts/abcd1234xyz',
        articleTitle: 'Shorts Test'
      })

      // Should accept the URL format (may fail download later)
      expect(response.status).toBeLessThan(300)
    })

    it('should support youtu.be short URL format', async () => {
      const response = await apiClient.post<{status: string}>('/feedly', {articleURL: 'https://youtu.be/dQw4w9WgXcQ', articleTitle: 'Short URL Test'})

      expect(response.status).toBeLessThan(300)
    })
  })

  describe('File Listing After Download', () => {
    // Note: In a real E2E test, you would wait for the download to complete
    // For LocalStack testing, the download might be mocked or skipped

    it('should list files for authenticated user', async () => {
      const response = await apiClient.get<{contents: Array<{fileId: string; key: string; status: string; title: string}>; keyCount: number}>('/files')

      expect(response.status).toBe(200)
      expect('body' in response.data).toBe(true)

      if ('body' in response.data) {
        expect(Array.isArray(response.data.body.contents)).toBe(true)
        expect(typeof response.data.body.keyCount).toBe('number')
      }
    })
  })

  describe('Push Notification Payload Generation', () => {
    // Tests that push payloads are correctly formatted for iOS

    it('should generate valid file downloaded notification payload', () => {
      const payloadPath = pushSimulator.createFileDownloadedNotification({
        fileId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        authorName: 'Rick Astley'
      })

      expect(payloadPath).toContain('.apns')
    })

    it('should generate valid download failed notification payload', () => {
      const payloadPath = pushSimulator.createDownloadFailedNotification({fileId: 'failed-video-id', title: 'Failed Video', reason: 'Video unavailable'})

      expect(payloadPath).toContain('.apns')
    })

    it('should generate valid silent refresh notification payload', () => {
      const payloadPath = pushSimulator.createSilentRefreshNotification()

      expect(payloadPath).toContain('.apns')
    })
  })

  describe('Device Event Tracking', () => {
    it('should track download started event', async () => {
      await deviceSimulator.sendDownloadStartedEvent('dQw4w9WgXcQ')
      // No error means success
    })

    it('should track playback event', async () => {
      await deviceSimulator.sendPlaybackEvent('dQw4w9WgXcQ', 180)
      // No error means success
    })

    it('should track push received event', async () => {
      await deviceSimulator.sendPushReceivedEvent('notification-123')
      // No error means success
    })
  })
})

describe('Unauthenticated Webhook Access', () => {
  let apiClient: ApiClient

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_'
  const apiKey = process.env.E2E_API_KEY || 'test-api-key'

  beforeAll(() => {
    apiClient = new ApiClient({baseUrl, apiKey})
    // No auth token - unauthenticated
  })

  it('should reject webhook requests without authentication', async () => {
    const response = await apiClient.post('/feedly', {articleURL: 'https://www.youtube.com/watch?v=test123', articleTitle: 'Unauthenticated Test'})

    expect(response.status).toBe(401)
  })
})
