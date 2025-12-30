/**
 * APNS Mock Helper
 *
 * Provides mock APNS client for integration tests without real Apple connectivity.
 * Used by PruneDevices tests to simulate device health checks.
 *
 * The mock simulates the apns2 library's behavior:
 * - ApnsClient.send() returns successfully for active devices
 * - ApnsClient.send() throws with statusCode 410 for disabled devices
 */
import {type Mock, vi} from 'vitest'

export interface MockApnsResponse {
  deviceToken: string
  isDisabled: boolean
}

export interface ApnsMockResult {
  ApnsClient: Mock
  Notification: Mock
  Priority: {throttled: number}
  PushType: {background: string}
  mocks: {send: Mock; clientConstructor: Mock}
}

/**
 * Create a mock APNS module that returns controlled responses.
 *
 * @param deviceResponses - Array of device tokens and their disabled status
 * @returns Mock apns2 module with configurable behavior
 *
 * @example
 * ```typescript
 * const apnsMock = createApnsMock([
 *   {deviceToken: 'active-token', isDisabled: false},
 *   {deviceToken: 'disabled-token', isDisabled: true}
 * ])
 *
 * vi.mock('apns2', () => apnsMock)
 * ```
 */
export function createApnsMock(deviceResponses: MockApnsResponse[]): ApnsMockResult {
  const responseMap = new Map(deviceResponses.map((r) => [r.deviceToken, r.isDisabled]))

  const sendMock = vi.fn().mockImplementation((notification: {deviceToken: string}) => {
    const token = notification.deviceToken
    const isDisabled = responseMap.get(token) ?? false

    if (isDisabled) {
      // Simulate APNS 410 Gone response for disabled devices
      const error = new Error('Unregistered') as Error & {statusCode: number; reason: string}
      error.statusCode = 410
      error.reason = 'Unregistered'
      throw error
    }

    // Successful send for active devices
    return Promise.resolve({sent: [notification]})
  })

  const clientConstructorMock = vi.fn().mockImplementation(() => ({send: sendMock}))

  return {
    ApnsClient: clientConstructorMock,
    Notification: vi.fn().mockImplementation((token: string, payload: object) => ({deviceToken: token, ...payload})),
    Priority: {throttled: 5},
    PushType: {background: 'background'},
    mocks: {send: sendMock, clientConstructor: clientConstructorMock}
  }
}

/**
 * Update the mock responses for a specific device token.
 * Use this to change device status during test execution.
 *
 * @param mock - The APNS mock result from createApnsMock
 * @param deviceToken - The device token to update
 * @param isDisabled - Whether the device should be treated as disabled
 */
export function updateMockDeviceStatus(mock: ApnsMockResult, deviceToken: string, isDisabled: boolean): void {
  const currentImpl = mock.mocks.send.getMockImplementation()

  mock.mocks.send.mockImplementation((notification: {deviceToken: string}) => {
    if (notification.deviceToken === deviceToken) {
      if (isDisabled) {
        const error = new Error('Unregistered') as Error & {statusCode: number; reason: string}
        error.statusCode = 410
        error.reason = 'Unregistered'
        throw error
      }
      return Promise.resolve({sent: [notification]})
    }
    // Fall through to original implementation for other tokens
    return currentImpl?.(notification)
  })
}

/**
 * Create a mock that always succeeds (all devices active).
 * Useful for tests that don't care about APNS behavior.
 */
export function createSuccessfulApnsMock(): ApnsMockResult {
  return createApnsMock([])
}

/**
 * Create a mock that always fails with 410 (all devices disabled).
 * Useful for testing pruning behavior.
 */
export function createFailingApnsMock(): ApnsMockResult {
  const sendMock = vi.fn().mockImplementation(() => {
    const error = new Error('Unregistered') as Error & {statusCode: number; reason: string}
    error.statusCode = 410
    error.reason = 'Unregistered'
    throw error
  })

  const clientConstructorMock = vi.fn().mockImplementation(() => ({send: sendMock}))

  return {
    ApnsClient: clientConstructorMock,
    Notification: vi.fn().mockImplementation((token: string, payload: object) => ({deviceToken: token, ...payload})),
    Priority: {throttled: 5},
    PushType: {background: 'background'},
    mocks: {send: sendMock, clientConstructor: clientConstructorMock}
  }
}
