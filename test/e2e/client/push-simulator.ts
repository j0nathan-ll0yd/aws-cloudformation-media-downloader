/**
 * Push Notification Simulator
 *
 * Simulates APNS (Apple Push Notification Service) behavior for E2E testing.
 * Generates mock device tokens and push notification payloads.
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

export interface ApnsPayload {
  aps: {
    alert?: {title?: string; subtitle?: string; body?: string} | string
    badge?: number
    sound?: string | {name: string; critical?: number; volume?: number}
    'thread-id'?: string
    category?: string
    'content-available'?: number
    'mutable-content'?: number
    'target-content-id'?: string
    'interruption-level'?: 'passive' | 'active' | 'time-sensitive' | 'critical'
    'relevance-score'?: number
  }
  // Custom data payload
  [key: string]: unknown
}

export interface SimulatorPushPayload extends ApnsPayload {
  'Simulator Target Bundle': string
}

/**
 * Generate a mock APNS device token
 * Real tokens are 32 bytes (64 hex characters)
 */
export function generateMockDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate a deterministic device token for a given device ID
 * Useful for tests that need consistent tokens
 */
export function generateDeterministicDeviceToken(deviceId: string): string {
  const hash = crypto.createHash('sha256').update(deviceId).digest()
  return hash.subarray(0, 32).toString('hex')
}

/**
 * Create a push notification payload for file download completion
 */
export function createFileDownloadedPayload(fileInfo: {fileId: string; title: string; authorName?: string}): ApnsPayload {
  return {
    aps: {
      alert: {title: 'Download Complete', subtitle: fileInfo.authorName, body: fileInfo.title},
      sound: 'default',
      badge: 1,
      'mutable-content': 1,
      'interruption-level': 'active'
    },
    fileId: fileInfo.fileId,
    type: 'file_downloaded'
  }
}

/**
 * Create a push notification payload for download failure
 */
export function createDownloadFailedPayload(fileInfo: {fileId: string; title: string; reason?: string}): ApnsPayload {
  return {
    aps: {alert: {title: 'Download Failed', body: `Failed to download: ${fileInfo.title}`}, sound: 'default', 'interruption-level': 'active'},
    fileId: fileInfo.fileId,
    type: 'download_failed',
    reason: fileInfo.reason || 'Unknown error'
  }
}

/**
 * Create a silent push notification for background refresh
 */
export function createSilentRefreshPayload(): ApnsPayload {
  return {aps: {'content-available': 1}, type: 'background_refresh'}
}

/**
 * Convert an APNS payload to simulator format
 * Adds the required 'Simulator Target Bundle' field
 */
export function toSimulatorPayload(payload: ApnsPayload, bundleId: string = 'com.offlinemediadownloader.app'): SimulatorPushPayload {
  return {'Simulator Target Bundle': bundleId, ...payload}
}

/**
 * Save a push payload to an .apns file for simulator testing
 */
export function saveApnsFile(payload: ApnsPayload, filePath: string, bundleId: string = 'com.offlinemediadownloader.app'): void {
  const simulatorPayload = toSimulatorPayload(payload, bundleId)
  const dir = path.dirname(filePath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true})
  }

  fs.writeFileSync(filePath, JSON.stringify(simulatorPayload, null, 2))
}

/**
 * Generate xcrun simctl push command
 */
export function generateSimctlPushCommand(deviceId: string, bundleId: string, payloadPath: string): string {
  return `xcrun simctl push ${deviceId} ${bundleId} ${payloadPath}`
}

/**
 * PushSimulator class for managing push notification testing
 */
export class PushSimulator {
  private bundleId: string
  private fixturesDir: string

  constructor(options?: {bundleId?: string; fixturesDir?: string}) {
    this.bundleId = options?.bundleId || 'com.offlinemediadownloader.app'
    this.fixturesDir = options?.fixturesDir || path.join(process.cwd(), 'test/e2e/fixtures/push-payloads')
  }

  /**
   * Generate and save a file downloaded notification
   */
  createFileDownloadedNotification(fileInfo: {fileId: string; title: string; authorName?: string}): string {
    const payload = createFileDownloadedPayload(fileInfo)
    const filePath = path.join(this.fixturesDir, `file-downloaded-${fileInfo.fileId}.apns`)
    saveApnsFile(payload, filePath, this.bundleId)
    return filePath
  }

  /**
   * Generate and save a download failed notification
   */
  createDownloadFailedNotification(fileInfo: {fileId: string; title: string; reason?: string}): string {
    const payload = createDownloadFailedPayload(fileInfo)
    const filePath = path.join(this.fixturesDir, `download-failed-${fileInfo.fileId}.apns`)
    saveApnsFile(payload, filePath, this.bundleId)
    return filePath
  }

  /**
   * Generate and save a silent refresh notification
   */
  createSilentRefreshNotification(): string {
    const payload = createSilentRefreshPayload()
    const filePath = path.join(this.fixturesDir, 'silent-refresh.apns')
    saveApnsFile(payload, filePath, this.bundleId)
    return filePath
  }

  /**
   * Get the simctl command to send a push notification
   */
  getSimctlCommand(deviceId: string, payloadPath: string): string {
    return generateSimctlPushCommand(deviceId, this.bundleId, payloadPath)
  }

  /**
   * Clean up generated payload files
   */
  cleanup(): void {
    if (fs.existsSync(this.fixturesDir)) {
      const files = fs.readdirSync(this.fixturesDir)
      for (const file of files) {
        if (file.endsWith('.apns')) {
          fs.unlinkSync(path.join(this.fixturesDir, file))
        }
      }
    }
  }
}
