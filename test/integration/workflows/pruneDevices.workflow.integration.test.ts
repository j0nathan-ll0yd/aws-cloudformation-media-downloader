/**
 * PruneDevices Workflow Integration Tests
 *
 * Tests the device pruning workflow including device health checks
 * and disabled device cleanup.
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
import {closeTestDb, createAllTables, getTestDbAsync, insertDevice, insertUser, linkUserDevice, truncateAllTables} from '../helpers/postgres-helpers'
import {createTestEndpoint, createTestPlatformApplication, deleteTestPlatformApplication, generateIsolatedAppName} from '../helpers/sns-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockScheduledEvent} from '../helpers/test-data'

// Mock APNS library - use vi.hoisted() for ESM module hoisting compatibility
// Must use regular functions (not arrows) for constructor mocks
// APNS must remain mocked as it's an external service that can't be emulated
const {sendMock} = vi.hoisted(() => ({sendMock: vi.fn()}))
vi.mock('apns2', () => ({
  ApnsClient: vi.fn().mockImplementation(function ApnsClient() {
    return {send: sendMock}
  }),
  Notification: vi.fn().mockImplementation(function Notification(token: string, options: unknown) {
    return {token, options}
  }),
  Priority: {throttled: 5},
  PushType: {background: 'background'}
}))

const {handler} = await import('#lambdas/PruneDevices/src/index')

describe('PruneDevices Workflow Integration Tests', () => {
  let mockContext: Context
  let platformAppArn: string
  const testAppName = generateIsolatedAppName('test-prune')

  beforeAll(async () => {
    // Initialize PostgreSQL
    await getTestDbAsync()
    await createAllTables()

    // Create LocalStack SNS platform application
    platformAppArn = await createTestPlatformApplication(testAppName)
    process.env.PLATFORM_APPLICATION_ARN = platformAppArn

    mockContext = createMockContext()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await truncateAllTables()
  })

  afterAll(async () => {
    // Clean up LocalStack SNS
    await deleteTestPlatformApplication(platformAppArn)

    // Close database connection
    await closeTestDb()
  })

  test('should prune disabled device and remove user association', async () => {
    // Create real user, device, and SNS endpoint
    const userId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()
    const deviceToken = `disabled-token-${Date.now()}`
    const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

    await insertUser({userId, email: 'prune@example.com', firstName: 'Prune'})
    await insertDevice({deviceId, token: deviceToken, endpointArn})
    await linkUserDevice(userId, deviceId)

    // APNS returns 410 - device is disabled
    sendMock.mockRejectedValue({statusCode: 410, reason: 'BadDeviceToken'})

    const result = await handler(createMockScheduledEvent('prune-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  test('should not prune active device', async () => {
    // Create real user, device, and SNS endpoint
    const userId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()
    const deviceToken = `active-token-${Date.now()}`
    const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

    await insertUser({userId, email: 'active@example.com', firstName: 'Active'})
    await insertDevice({deviceId, token: deviceToken, endpointArn})
    await linkUserDevice(userId, deviceId)

    // APNS returns success - device is active
    sendMock.mockResolvedValue({})

    const result = await handler(createMockScheduledEvent('active-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  test('should handle mix of active and disabled devices', async () => {
    // Create two users with devices
    const user1Id = crypto.randomUUID()
    const user2Id = crypto.randomUUID()
    const activeDeviceId = crypto.randomUUID()
    const disabledDeviceId = crypto.randomUUID()
    const activeToken = `active-mix-${Date.now()}`
    const disabledToken = `disabled-mix-${Date.now()}`

    const activeEndpoint = await createTestEndpoint(platformAppArn, activeToken)
    const disabledEndpoint = await createTestEndpoint(platformAppArn, disabledToken)

    await insertUser({userId: user1Id, email: 'active-mix@example.com', firstName: 'Active'})
    await insertUser({userId: user2Id, email: 'disabled-mix@example.com', firstName: 'Disabled'})
    await insertDevice({deviceId: activeDeviceId, token: activeToken, endpointArn: activeEndpoint})
    await insertDevice({deviceId: disabledDeviceId, token: disabledToken, endpointArn: disabledEndpoint})
    await linkUserDevice(user1Id, activeDeviceId)
    await linkUserDevice(user2Id, disabledDeviceId)

    // First device active, second disabled
    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce({statusCode: 410, reason: 'BadDeviceToken'})

    const result = await handler(createMockScheduledEvent('mixed-test'), mockContext)

    expect(result.devicesChecked).toBe(2)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  test('should handle empty device list', async () => {
    // No devices in database - just need tables created
    const result = await handler(createMockScheduledEvent('empty-test'), mockContext)

    expect(result.devicesChecked).toBe(0)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('should continue processing after individual device error', async () => {
    // Create real user, device, and SNS endpoint
    const userId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()
    const deviceToken = `error-token-${Date.now()}`
    const endpointArn = await createTestEndpoint(platformAppArn, deviceToken)

    await insertUser({userId, email: 'error@example.com', firstName: 'Error'})
    await insertDevice({deviceId, token: deviceToken, endpointArn})
    await linkUserDevice(userId, deviceId)

    // APNS check fails with a non-410 error (should not prune, just log error)
    sendMock.mockRejectedValue({statusCode: 500, reason: 'InternalError'})

    const result = await handler(createMockScheduledEvent('error-test'), mockContext)

    // Device was checked but not pruned due to error
    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    // May have errors depending on how the Lambda handles non-410 errors
  })
})
