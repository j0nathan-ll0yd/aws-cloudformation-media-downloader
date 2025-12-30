/**
 * PruneDevices Workflow Integration Tests
 *
 * Tests the device pruning workflow:
 * - Entity queries: Mocked for device operations
 * - APNS: Mocked for device health checks
 *
 * Workflow:
 * 1. Get all devices via entity queries (mocked)
 * 2. Check each device against APNS (mocked)
 * 3. Delete disabled devices and their user associations
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.APNS_SIGNING_KEY = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEICNJcmZZUq+lK8qQxjy3IzGaH9D8j3qHJ/x+VFkgJk3woAcGBSuBBAAK
oUQDQgAEFBw7y/ZZhN/j8K/zqt5MIbNkqxHYtqIlhE0x3kKjXJ9g9a3S5q3C2bEL
nJ3y4eL2qC5pF4jF8G/XLqF9kNc8qg==
-----END EC PRIVATE KEY-----`
process.env.APNS_TEAM = 'XXXXXX'
process.env.APNS_KEY_ID = 'XXXXXX'
process.env.APNS_DEFAULT_TOPIC = 'test.app'

import {afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {createMockContext} from '../helpers/lambda-context'
import {createMockDevice, createMockScheduledEvent} from '../helpers/test-data'

// Mock entity queries - must use vi.hoisted for ESM
const {getAllDevicesMock, deleteUserDevicesByDeviceIdMock} = vi.hoisted(() => ({getAllDevicesMock: vi.fn(), deleteUserDevicesByDeviceIdMock: vi.fn()}))

vi.mock('#entities/queries', () => ({getAllDevices: getAllDevicesMock, deleteUserDevicesByDeviceId: deleteUserDevicesByDeviceIdMock}))

// Mock APNS library - use vi.hoisted() for ESM module hoisting compatibility
// Must use regular functions (not arrows) for constructor mocks
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

// Mock device service for deletion - use vi.hoisted() for ESM compatibility
const {deleteDeviceMock} = vi.hoisted(() => ({deleteDeviceMock: vi.fn()}))
vi.mock('#lib/domain/device/device-service', () => ({deleteDevice: deleteDeviceMock}))

// Import handler after mocks
const {handler} = await import('#lambdas/PruneDevices/src/index')

describe('PruneDevices Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(() => {
    mockContext = createMockContext()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should prune disabled device and remove user association', async () => {
    const deviceId = crypto.randomUUID()
    const mockDevice = createMockDevice({deviceId, token: 'disabled-device-token'})

    getAllDevicesMock.mockResolvedValue([mockDevice])
    sendMock.mockRejectedValue({statusCode: 410, reason: 'BadDeviceToken'})
    deleteUserDevicesByDeviceIdMock.mockResolvedValue(undefined)
    deleteDeviceMock.mockResolvedValue(undefined)

    const result = await handler(createMockScheduledEvent('prune-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(deleteUserDevicesByDeviceIdMock).toHaveBeenCalledWith(deviceId)
    expect(deleteDeviceMock).toHaveBeenCalledWith(mockDevice)
  })

  test('should not prune active device', async () => {
    const deviceId = crypto.randomUUID()
    const mockDevice = createMockDevice({deviceId, token: 'active-device-token'})

    getAllDevicesMock.mockResolvedValue([mockDevice])
    sendMock.mockResolvedValue({})

    const result = await handler(createMockScheduledEvent('active-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(deleteDeviceMock).not.toHaveBeenCalled()
  })

  test('should handle mix of active and disabled devices', async () => {
    const activeDeviceId = crypto.randomUUID()
    const disabledDeviceId = crypto.randomUUID()
    const activeDevice = createMockDevice({deviceId: activeDeviceId, token: 'active-token'})
    const disabledDevice = createMockDevice({deviceId: disabledDeviceId, token: 'disabled-token'})

    getAllDevicesMock.mockResolvedValue([activeDevice, disabledDevice])
    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce({statusCode: 410, reason: 'BadDeviceToken'})
    deleteUserDevicesByDeviceIdMock.mockResolvedValue(undefined)
    deleteDeviceMock.mockResolvedValue(undefined)

    const result = await handler(createMockScheduledEvent('mixed-test'), mockContext)

    expect(result.devicesChecked).toBe(2)
    expect(result.devicesPruned).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  test('should handle empty device list', async () => {
    getAllDevicesMock.mockResolvedValue([])

    const result = await handler(createMockScheduledEvent('empty-test'), mockContext)

    expect(result.devicesChecked).toBe(0)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  test('should capture error when device deletion fails', async () => {
    const deviceId = crypto.randomUUID()
    const mockDevice = createMockDevice({deviceId, token: 'fail-delete-token'})

    getAllDevicesMock.mockResolvedValue([mockDevice])
    sendMock.mockRejectedValue({statusCode: 410, reason: 'BadDeviceToken'})
    deleteUserDevicesByDeviceIdMock.mockResolvedValue(undefined)
    deleteDeviceMock.mockRejectedValue(new Error('Database delete failed'))

    const result = await handler(createMockScheduledEvent('fail-test'), mockContext)

    expect(result.devicesChecked).toBe(1)
    expect(result.devicesPruned).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Database delete failed')
  })
})
