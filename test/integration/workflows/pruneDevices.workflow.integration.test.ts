/**
 * PruneDevices Workflow Integration Tests
 *
 * Tests the device pruning workflow against real services:
 * - PostgreSQL: Device and UserDevice records
 * - APNS: Mocked for device health checks
 *
 * Workflow:
 * 1. Get all devices from PostgreSQL
 * 2. Check each device against APNS
 * 3. Delete disabled devices and their user associations
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'
process.env.APNS_SIGNING_KEY = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEICNJcmZZUq+lK8qQxjy3IzGaH9D8j3qHJ/x+VFkgJk3woAcGBSuBBAAK
oUQDQgAEFBw7y/ZZhN/j8K/zqt5MIbNkqxHYtqIlhE0x3kKjXJ9g9a3S5q3C2bEL
nJ3y4eL2qC5pF4jF8G/XLqF9kNc8qg==
-----END EC PRIVATE KEY-----`
process.env.APNS_TEAM = 'XXXXXX'
process.env.APNS_KEY_ID = 'XXXXXX'
process.env.APNS_DEFAULT_TOPIC = 'test.app'

import {afterAll, afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  dropAllTables,
  getDevice,
  insertDevice,
  insertUser,
  linkUserDevice,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'

// Mock APNS library
const sendMock = vi.fn()
vi.mock('apns2',
  () => ({
    ApnsClient: vi.fn().mockImplementation(() => ({send: sendMock})),
    Notification: vi.fn().mockImplementation((token, options) => ({token, options})),
    Priority: {throttled: 5},
    PushType: {background: 'background'}
  }))

// Mock device service for deletion
const deleteDeviceMock = vi.fn()
vi.mock('#lib/domain/device/device-service', () => ({deleteDevice: deleteDeviceMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/PruneDevices/src/index')

describe('PruneDevices Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await truncateAllTables()
  })

  afterAll(async () => {
    await dropAllTables()
    await closeTestDb()
  })

  test('should prune disabled device and remove user association', async () => {
    const userId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()

    await insertUser({userId, email: 'prune@example.com', firstName: 'Prune'})
    await insertDevice({
      deviceId,
      name: 'Test iPhone',
      token: 'disabled-device-token',
      systemVersion: '17.0',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/app/test'
    })
    await linkUserDevice(userId, deviceId)

    sendMock.mockRejectedValue({statusCode: 410, reason: 'BadDeviceToken'})
    deleteDeviceMock.mockResolvedValue(undefined)

    const result = await handler(createMockScheduledEvent('prune-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  test('should not prune active device', async () => {
    const userId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()

    await insertUser({userId, email: 'active@example.com', firstName: 'Active'})
    await insertDevice({
      deviceId,
      name: 'Active iPhone',
      token: 'active-device-token',
      systemVersion: '17.0',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/app/active'
    })
    await linkUserDevice(userId, deviceId)

    sendMock.mockResolvedValue({})

    const result = await handler(createMockScheduledEvent('active-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)

    const device = await getDevice(deviceId)
    expect(device).not.toBeNull()
  })

  test('should handle mix of active and disabled devices', async () => {
    const userId = crypto.randomUUID()
    const activeDeviceId = crypto.randomUUID()
    const disabledDeviceId = crypto.randomUUID()

    await insertUser({userId, email: 'mixed@example.com', firstName: 'Mixed'})

    await insertDevice({
      deviceId: activeDeviceId,
      name: 'Active Device',
      token: 'active-token',
      systemVersion: '17.0',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/app/active'
    })
    await insertDevice({
      deviceId: disabledDeviceId,
      name: 'Disabled Device',
      token: 'disabled-token',
      systemVersion: '16.0',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/app/disabled'
    })

    await linkUserDevice(userId, activeDeviceId)
    await linkUserDevice(userId, disabledDeviceId)

    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce({statusCode: 410, reason: 'BadDeviceToken'})
    deleteDeviceMock.mockResolvedValue(undefined)

    const result = await handler(createMockScheduledEvent('mixed-test'), mockContext)

    expect(result.devicesChecked).toBe(2)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  test('should handle empty device list', async () => {
    const result = await handler(createMockScheduledEvent('empty-test'), mockContext)

    expect(result.devicesChecked).toBe(0)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('should capture error when device deletion fails', async () => {
    const deviceId = crypto.randomUUID()

    await insertDevice({
      deviceId,
      name: 'Failed Delete Device',
      token: 'fail-delete-token',
      systemVersion: '17.0',
      systemName: 'iOS',
      endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/app/fail'
    })

    sendMock.mockRejectedValue({statusCode: 410, reason: 'BadDeviceToken'})
    deleteDeviceMock.mockRejectedValue(new Error('Database delete failed'))

    const result = await handler(createMockScheduledEvent('fail-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Database delete failed')
  })
})
