/**
 * Authentication Client Simulation
 *
 * Simulates Sign In with Apple authentication flow for E2E testing.
 * Provides methods to generate mock tokens and manage user sessions.
 */

import {ApiClient, type AuthTokens} from './api-client.js'

export interface AppleIdCredentials {
  identityToken: string
  authorizationCode: string
  user: string
  email?: string
  fullName?: {givenName?: string; familyName?: string}
}

export interface MockAppleIdConfig {
  userId?: string
  email?: string
  firstName?: string
  lastName?: string
}

/**
 * Generates a mock Apple ID token for testing
 *
 * In production, this token comes from ASAuthorizationAppleIDCredential.
 * For testing, we generate a deterministic mock token that the test
 * environment can validate.
 */
export function generateMockAppleIdToken(config: MockAppleIdConfig = {}): string {
  const userId = config.userId || `test-user-${Date.now()}`
  const payload = {
    iss: 'https://appleid.apple.com',
    aud: 'com.offlinemediadownloader.app',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    sub: userId,
    email: config.email || `${userId}@privaterelay.appleid.com`,
    email_verified: true,
    is_private_email: true,
    auth_time: Math.floor(Date.now() / 1000),
    nonce_supported: true
  }

  // Create a mock JWT-like token (not cryptographically valid, but structurally correct)
  const header = Buffer.from(JSON.stringify({alg: 'RS256', kid: 'test-key'})).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = Buffer.from('mock-signature-for-testing').toString('base64url')

  return `${header}.${body}.${signature}`
}

/**
 * Authentication client that wraps ApiClient with auth-specific methods
 */
export class AuthClient {
  private apiClient: ApiClient
  private currentUser: AuthTokens | null = null

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  /**
   * Register a new user with mock Apple ID credentials
   */
  async register(config: MockAppleIdConfig = {}): Promise<AuthTokens> {
    const idToken = generateMockAppleIdToken(config)

    const response = await this.apiClient.post<AuthTokens>('/user/register', {
      idToken,
      firstName: config.firstName || 'Test',
      lastName: config.lastName || 'User'
    })

    if (response.status !== 200 || 'error' in response.data) {
      throw new Error(`Registration failed: ${JSON.stringify(response.data)}`)
    }

    this.currentUser = response.data.body
    this.apiClient.setAuthToken(this.currentUser.token)

    return this.currentUser
  }

  /**
   * Login an existing user with mock Apple ID credentials
   */
  async login(config: MockAppleIdConfig = {}): Promise<AuthTokens> {
    const idToken = generateMockAppleIdToken(config)

    const response = await this.apiClient.post<AuthTokens>('/user/login', {idToken})

    if (response.status !== 200 || 'error' in response.data) {
      throw new Error(`Login failed: ${JSON.stringify(response.data)}`)
    }

    this.currentUser = response.data.body
    this.apiClient.setAuthToken(this.currentUser.token)

    return this.currentUser
  }

  /**
   * Refresh the current session token
   */
  async refreshToken(): Promise<AuthTokens> {
    if (!this.currentUser) {
      throw new Error('No active session to refresh')
    }

    const response = await this.apiClient.post<AuthTokens>('/user/refresh')

    if (response.status !== 200 || 'error' in response.data) {
      throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`)
    }

    this.currentUser = response.data.body
    this.apiClient.setAuthToken(this.currentUser.token)

    return this.currentUser
  }

  /**
   * Delete the current user account
   */
  async deleteAccount(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No active session to delete')
    }

    const response = await this.apiClient.delete('/user')

    if (response.status !== 204) {
      throw new Error(`Account deletion failed: ${JSON.stringify(response.data)}`)
    }

    this.currentUser = null
    this.apiClient.clearAuthToken()
  }

  /**
   * Get the current user info
   */
  getCurrentUser(): AuthTokens | null {
    return this.currentUser
  }

  /**
   * Check if there's an active session
   */
  isAuthenticated(): boolean {
    if (!this.currentUser) {
      return false
    }
    return this.currentUser.expiresAt > Date.now()
  }

  /**
   * Logout (clear local session without server call)
   */
  logout(): void {
    this.currentUser = null
    this.apiClient.clearAuthToken()
  }
}

/**
 * Create a test user and return the auth client
 * Convenience function for E2E tests
 */
export async function createTestUser(apiClient: ApiClient, config: MockAppleIdConfig = {}): Promise<{authClient: AuthClient; user: AuthTokens}> {
  const authClient = new AuthClient(apiClient)
  const user = await authClient.register(config)
  return {authClient, user}
}

/**
 * Cleanup a test user
 * Call this in test teardown
 */
export async function cleanupTestUser(authClient: AuthClient): Promise<void> {
  if (authClient.isAuthenticated()) {
    await authClient.deleteAccount()
  }
}
