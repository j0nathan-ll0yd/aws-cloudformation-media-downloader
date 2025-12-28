/**
 * iOS Client Simulation - E2E Testing Utilities
 *
 * This module provides a complete simulation of the iOS app's networking
 * layer for end-to-end testing without requiring the actual iOS application.
 *
 * @example
 * ```typescript
 * import { createLocalStackClient, AuthClient, DeviceSimulator } from './client';
 *
 * // Create API client for LocalStack
 * const apiClient = createLocalStackClient();
 *
 * // Create and register a test user
 * const authClient = new AuthClient(apiClient);
 * await authClient.register({ firstName: 'Test', lastName: 'User' });
 *
 * // Create and register a device
 * const deviceSim = new DeviceSimulator(apiClient);
 * await deviceSim.register();
 *
 * // Clean up
 * await authClient.deleteAccount();
 * ```
 */

// API Client
export {
  ApiClient,
  type ApiClientConfig,
  type ApiError,
  type ApiResponse,
  type AuthTokens,
  createLocalStackClient,
  createRemoteClient
} from './api-client.js'

// Authentication
export { type AppleIdCredentials, AuthClient, cleanupTestUser, createTestUser, generateMockAppleIdToken, type MockAppleIdConfig } from './auth-client.js'

// Push Notifications
export {
  type ApnsPayload,
  createDownloadFailedPayload,
  createFileDownloadedPayload,
  createSilentRefreshPayload,
  generateDeterministicDeviceToken,
  generateMockDeviceToken,
  generateSimctlPushCommand,
  PushSimulator,
  saveApnsFile,
  type SimulatorPushPayload,
  toSimulatorPayload
} from './push-simulator.js'

// Device Simulation
export {
  createDevicePool,
  createDeviceSimulator,
  type DeviceEventPayload,
  type DeviceInfo,
  type DeviceRegistrationResponse,
  DeviceSimulator,
  generateDevicePool,
  generateMockDevice
} from './device-simulator.js'

/**
 * Quick setup for E2E tests
 * Creates a complete test environment with authenticated user and registered device
 */
export async function setupE2ETestEnvironment(
  options?: {baseUrl?: string; apiKey?: string; userName?: {firstName?: string; lastName?: string}; deviceName?: string}
): Promise<
  {
    apiClient: import('./api-client.js').ApiClient
    authClient: import('./auth-client.js').AuthClient
    deviceSimulator: import('./device-simulator.js').DeviceSimulator
    user: import('./api-client.js').AuthTokens
    cleanup: () => Promise<void>
  }
> {
  const {ApiClient} = await import('./api-client.js')
  const {AuthClient} = await import('./auth-client.js')
  const {DeviceSimulator, generateMockDevice} = await import('./device-simulator.js')

  const apiClient = new ApiClient({
    baseUrl: options?.baseUrl || process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_',
    apiKey: options?.apiKey || process.env.E2E_API_KEY || 'test-api-key'
  })

  const authClient = new AuthClient(apiClient)
  const user = await authClient.register({firstName: options?.userName?.firstName || 'E2E', lastName: options?.userName?.lastName || 'TestUser'})

  const device = generateMockDevice({name: options?.deviceName || 'E2E Test Device'})
  const deviceSimulator = new DeviceSimulator(apiClient, device)
  await deviceSimulator.register()

  const cleanup = async () => {
    try {
      await authClient.deleteAccount()
    } catch {
      // Ignore cleanup errors
    }
  }

  return {apiClient, authClient, deviceSimulator, user, cleanup}
}
