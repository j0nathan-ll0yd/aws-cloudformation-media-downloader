/**
 * Device Simulator
 *
 * Simulates iOS device behavior for E2E testing.
 * Manages device registration, token updates, and device events.
 */

import {ApiClient} from './api-client.js'
import {generateDeterministicDeviceToken, generateMockDeviceToken} from './push-simulator.js'
import * as crypto from 'crypto'

export interface DeviceInfo {
  deviceId: string
  name: string
  systemName: string
  systemVersion: string
  token: string
}

export interface DeviceRegistrationResponse {
  endpointArn: string
}

export interface DeviceEventPayload {
  event: string
  timestamp: string
  metadata?: Record<string, unknown>
}

/**
 * Generate a mock iOS device info structure
 */
export function generateMockDevice(options?: Partial<DeviceInfo>): DeviceInfo {
  const deviceId = options?.deviceId || crypto.randomUUID()
  return {
    deviceId,
    name: options?.name || 'Test iPhone',
    systemName: options?.systemName || 'iOS',
    systemVersion: options?.systemVersion || '17.0',
    token: options?.token || generateDeterministicDeviceToken(deviceId)
  }
}

/**
 * Generate a list of common iOS device models for testing
 */
export function generateDevicePool(): DeviceInfo[] {
  const devices = [
    {name: 'iPhone 15 Pro Max', systemVersion: '17.2'},
    {name: 'iPhone 15 Pro', systemVersion: '17.1'},
    {name: 'iPhone 15', systemVersion: '17.0'},
    {name: 'iPhone 14 Pro', systemVersion: '16.7'},
    {name: 'iPhone SE (3rd generation)', systemVersion: '16.5'},
    {name: 'iPad Pro (12.9-inch)', systemVersion: '17.0'},
    {name: 'iPad Air (5th generation)', systemVersion: '16.6'}
  ]

  return devices.map((device, index) => generateMockDevice({deviceId: `test-device-${index + 1}`, name: device.name, systemVersion: device.systemVersion}))
}

/**
 * Device simulator class for managing device operations
 */
export class DeviceSimulator {
  private apiClient: ApiClient
  private device: DeviceInfo
  private endpointArn: string | null = null

  constructor(apiClient: ApiClient, device?: DeviceInfo) {
    this.apiClient = apiClient
    this.device = device || generateMockDevice()
  }

  /**
   * Get the current device info
   */
  getDevice(): DeviceInfo {
    return this.device
  }

  /**
   * Get the registered endpoint ARN
   */
  getEndpointArn(): string | null {
    return this.endpointArn
  }

  /**
   * Register the device with the backend
   */
  async register(): Promise<DeviceRegistrationResponse> {
    const response = await this.apiClient.post<DeviceRegistrationResponse>('/device/register', this.device)

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Device registration failed: ${JSON.stringify(response.data)}`)
    }

    if ('error' in response.data) {
      throw new Error(`Device registration error: ${response.data.error.message}`)
    }

    this.endpointArn = response.data.body.endpointArn
    return response.data.body
  }

  /**
   * Update the device token (simulates token refresh)
   */
  async updateToken(): Promise<DeviceRegistrationResponse> {
    // Generate a new token
    this.device.token = generateMockDeviceToken()

    const response = await this.apiClient.post<DeviceRegistrationResponse>('/device/register', this.device)

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Device token update failed: ${JSON.stringify(response.data)}`)
    }

    if ('error' in response.data) {
      throw new Error(`Device token update error: ${response.data.error.message}`)
    }

    this.endpointArn = response.data.body.endpointArn
    return response.data.body
  }

  /**
   * Send a device event to the backend
   */
  async sendEvent(event: DeviceEventPayload): Promise<void> {
    const response = await this.apiClient.post('/device/event', event, {'x-device-uuid': this.device.deviceId})

    if (response.status !== 204) {
      throw new Error(`Device event failed: ${JSON.stringify(response.data)}`)
    }
  }

  /**
   * Send an app launch event
   */
  async sendAppLaunchEvent(): Promise<void> {
    await this.sendEvent({
      event: 'app_launch',
      timestamp: new Date().toISOString(),
      metadata: {app_version: '1.0.0', os_version: this.device.systemVersion, device_name: this.device.name}
    })
  }

  /**
   * Send a background refresh event
   */
  async sendBackgroundRefreshEvent(): Promise<void> {
    await this.sendEvent({event: 'background_refresh', timestamp: new Date().toISOString(), metadata: {trigger: 'scheduled'}})
  }

  /**
   * Send a push notification received event
   */
  async sendPushReceivedEvent(notificationId: string): Promise<void> {
    await this.sendEvent({event: 'push_received', timestamp: new Date().toISOString(), metadata: {notification_id: notificationId}})
  }

  /**
   * Send a file download started event
   */
  async sendDownloadStartedEvent(fileId: string): Promise<void> {
    await this.sendEvent({event: 'download_started', timestamp: new Date().toISOString(), metadata: {file_id: fileId}})
  }

  /**
   * Send a file playback event
   */
  async sendPlaybackEvent(fileId: string, duration: number): Promise<void> {
    await this.sendEvent({event: 'playback', timestamp: new Date().toISOString(), metadata: {file_id: fileId, duration_seconds: duration}})
  }

  /**
   * Subscribe to push notifications topic
   */
  async subscribeToNotifications(topicArn: string): Promise<{subscriptionArn: string}> {
    if (!this.endpointArn) {
      throw new Error('Device must be registered before subscribing')
    }

    const response = await this.apiClient.post<{subscriptionArn: string}>('/user/subscribe', {endpointArn: this.endpointArn, topicArn})

    if (response.status !== 201) {
      throw new Error(`Subscription failed: ${JSON.stringify(response.data)}`)
    }

    if ('error' in response.data) {
      throw new Error(`Subscription error: ${response.data.error.message}`)
    }

    return response.data.body
  }
}

/**
 * Create a device simulator with a pre-configured device
 */
export function createDeviceSimulator(apiClient: ApiClient, options?: Partial<DeviceInfo>): DeviceSimulator {
  const device = generateMockDevice(options)
  return new DeviceSimulator(apiClient, device)
}

/**
 * Create multiple device simulators for multi-device testing
 */
export function createDevicePool(apiClient: ApiClient, count: number = 3): DeviceSimulator[] {
  const devices = generateDevicePool().slice(0, count)
  return devices.map((device) => new DeviceSimulator(apiClient, device))
}
