/**
 * Shared test data builders for Better Auth entities
 * Used by both unit tests and integration tests to ensure consistency
 *
 * These builders provide sensible defaults and accept overrides for specific test cases.
 * This follows the Object Mother pattern for test data creation.
 */

/**
 * Identity provider data structure (from Sign in with Apple)
 */
type IdentityProvidersData = {
  userId: string
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

/**
 * User entity structure for ElectroDB
 */
export type MockUserData = {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName: string
  identityProviders: IdentityProvidersData
  createdAt?: number
  updatedAt?: number
}

/**
 * Session entity structure for ElectroDB
 */
export type MockSessionData = {
  sessionId: string
  userId: string
  expiresAt: number
  token: string
  ipAddress?: string
  userAgent?: string
  deviceId?: string
  createdAt?: number
  updatedAt?: number
}

/**
 * Account entity structure for ElectroDB
 */
export type MockAccountData = {
  accountId: string
  userId: string
  providerId: string
  providerAccountId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
  tokenType?: string
  idToken?: string
  createdAt?: number
  updatedAt?: number
}

/**
 * Verification token entity structure for ElectroDB
 */
export type MockVerificationTokenData = {identifier: string; token: string; expiresAt: number}

/**
 * Create mock user with sensible defaults
 *
 * @param overrides - Partial user data to override defaults
 * @returns Complete user object ready for ElectroDB entity operations
 */
export function createMockUser(overrides?: Partial<MockUserData>): MockUserData {
  const now = Date.now()
  return {
    userId: 'user-123',
    email: 'test@example.com',
    emailVerified: false,
    firstName: 'John',
    lastName: 'Doe',
    identityProviders: {userId: '', email: '', emailVerified: false, isPrivateEmail: false, accessToken: '', refreshToken: '', tokenType: '', expiresAt: 0},
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create mock session with sensible defaults
 *
 * @param overrides - Partial session data to override defaults
 * @returns Complete session object ready for ElectroDB entity operations
 */
export function createMockSession(overrides?: Partial<MockSessionData>): MockSessionData {
  const now = Date.now()
  return {
    sessionId: 'session-123',
    userId: 'user-123',
    expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days default
    token: 'token-abc',
    ipAddress: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
    deviceId: 'device-123',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create mock OAuth account with sensible defaults
 *
 * @param overrides - Partial account data to override defaults
 * @returns Complete account object ready for ElectroDB entity operations
 */
export function createMockAccount(overrides?: Partial<MockAccountData>): MockAccountData {
  const now = Date.now()
  return {
    accountId: 'account-123',
    userId: 'user-123',
    providerId: 'apple',
    providerAccountId: 'apple-user-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: now + 3600000, // 1 hour default
    scope: 'email profile',
    tokenType: 'Bearer',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create mock verification token with sensible defaults
 *
 * @param overrides - Partial token data to override defaults
 * @returns Complete verification token object ready for ElectroDB entity operations
 */
export function createMockVerificationToken(overrides?: Partial<MockVerificationTokenData>): MockVerificationTokenData {
  return {
    identifier: 'test@example.com',
    token: 'verify-token-123',
    expiresAt: Date.now() + 86400000, // 24 hours default
    ...overrides
  }
}

/**
 * Create minimal user for testing edge cases
 * Only required fields populated
 */
export function createMinimalUser(overrides?: Partial<MockUserData>): MockUserData {
  return createMockUser({
    firstName: '',
    lastName: '',
    identityProviders: {userId: '', email: '', emailVerified: false, isPrivateEmail: false, accessToken: '', refreshToken: '', tokenType: '', expiresAt: 0},
    ...overrides
  })
}

/**
 * Create session without optional fields
 * Tests that optional fields are handled correctly
 */
export function createMinimalSession(overrides?: Partial<MockSessionData>): MockSessionData {
  const full = createMockSession(overrides)
  return {sessionId: full.sessionId, userId: full.userId, expiresAt: full.expiresAt, token: full.token, createdAt: full.createdAt, updatedAt: full.updatedAt}
}

/**
 * Create account without optional OAuth metadata
 * Tests basic account linking without token details
 */
export function createMinimalAccount(overrides?: Partial<MockAccountData>): MockAccountData {
  const now = Date.now()
  return {
    accountId: 'account-123',
    userId: 'user-123',
    providerId: 'apple',
    providerAccountId: 'apple-user-123',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}
