/**
 * Entity Fixture Factories
 *
 * Factory functions for creating mock entity rows in tests.
 * Each factory provides sensible defaults that can be overridden.
 *
 * Usage:
 * ```typescript
 * import {createMockFile, createMockDevice, createMockUser} from '#test/helpers/entity-fixtures'
 *
 * const file = createMockFile()  // All defaults
 * const file2 = createMockFile({status: 'Failed', size: 0})  // Override specific fields
 * const device = createMockDevice({deviceId: 'custom-id'})
 * ```
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 */

/**
 * Row types matching Drizzle schema
 * These are the shapes returned by `db.select().from(table)`
 */

export interface FileRow {
  fileId: string
  size: number
  authorName: string
  authorUser: string
  publishDate: string
  description: string
  key: string
  url: string | null
  contentType: string
  title: string
  status: string
}

export interface DeviceRow {
  deviceId: string
  name: string
  token: string
  systemVersion: string
  systemName: string
  endpointArn: string
}

export interface UserRow {
  id: string
  email: string
  emailVerified: boolean
  name: string | null
  image: string | null
  firstName: string | null
  lastName: string | null
  appleDeviceId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserFileRow {
  userId: string
  fileId: string
  createdAt: Date
}

export interface UserDeviceRow {
  userId: string
  deviceId: string
  createdAt: Date
}

export interface SessionRow {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IdentityProviderRow {
  id: string
  userId: string
  providerUserId: string
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

export interface FileDownloadRow {
  fileId: string
  status: string
  retryCount: number
  maxRetries: number
  retryAfter: Date | null
  errorCategory: string | null
  lastError: string | null
  scheduledReleaseTime: Date | null
  sourceUrl: string | null
  correlationId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Default UUIDs for consistent test data
 */
export const DEFAULT_USER_ID = 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456'
export const DEFAULT_FILE_ID = 'dQw4w9WgXcQ'
export const DEFAULT_DEVICE_ID = '67C431DE-37D2-4BBA-9055-E9D2766517E1'
export const DEFAULT_SESSION_ID = 'session-1234-5678-9abc-def012345678'

/**
 * Create a mock file row with sensible defaults.
 *
 * Defaults to a "Downloaded" YouTube video with typical metadata.
 *
 * @example
 * const file = createMockFile()
 * const failedFile = createMockFile(\{status: 'Failed', size: 0\})
 * const customFile = createMockFile(\{fileId: 'custom123', title: 'My Video'\})
 */
export function createMockFile(overrides: Partial<FileRow> = {}): FileRow {
  const fileId = overrides.fileId ?? DEFAULT_FILE_ID
  return {
    fileId,
    size: 61548900,
    authorName: 'Philip DeFranco',
    authorUser: 'sxephil',
    publishDate: '2021-01-22T00:00:00.000Z',
    description: 'Test video description for unit tests',
    key: `${fileId}.mp4`,
    url: `https://example.cloudfront.net/${fileId}.mp4`,
    contentType: 'video/mp4',
    title: 'Test Video Title',
    status: 'Downloaded',
    ...overrides
  }
}

/**
 * Create a mock device row with sensible defaults.
 *
 * Defaults to an iPhone with valid APNS token and endpoint ARN.
 *
 * @example
 * const device = createMockDevice()
 * const customDevice = createMockDevice(\{name: "User's iPad", systemName: 'iPadOS'\})
 */
export function createMockDevice(overrides: Partial<DeviceRow> = {}): DeviceRow {
  const deviceId = overrides.deviceId ?? DEFAULT_DEVICE_ID
  return {
    deviceId,
    name: "Test User's iPhone",
    token: '6a077fd0efd36259b475f9d39997047eebbe45e1d197eed7d64f39d6643c7c23',
    systemVersion: '17.2.1',
    systemName: 'iOS',
    endpointArn: `arn:aws:sns:us-west-2:123456789012:endpoint/APNS_SANDBOX/MediaDownloader/${deviceId}`,
    ...overrides
  }
}

/**
 * Create a mock user row with sensible defaults.
 *
 * Defaults to a verified user with Sign In With Apple fields populated.
 *
 * @example
 * const user = createMockUser()
 * const unverifiedUser = createMockUser(\{emailVerified: false\})
 * const customUser = createMockUser(\{id: 'custom-uuid', email: 'custom\@example.com'\})
 */
export function createMockUser(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date()
  return {
    id: DEFAULT_USER_ID,
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    firstName: 'Test',
    lastName: 'User',
    appleDeviceId: 'apple-device-id-123',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create a mock user-file relationship row.
 *
 * Links a user to a file they have access to.
 *
 * @example
 * const userFile = createMockUserFile()
 * const customLink = createMockUserFile(\{userId: 'user-123', fileId: 'file-456'\})
 */
export function createMockUserFile(overrides: Partial<UserFileRow> = {}): UserFileRow {
  return {userId: DEFAULT_USER_ID, fileId: DEFAULT_FILE_ID, createdAt: new Date(), ...overrides}
}

/**
 * Create a mock user-device relationship row.
 *
 * Links a user to a device they have registered.
 *
 * @example
 * const userDevice = createMockUserDevice()
 * const customLink = createMockUserDevice(\{userId: 'user-123', deviceId: 'device-456'\})
 */
export function createMockUserDevice(overrides: Partial<UserDeviceRow> = {}): UserDeviceRow {
  return {userId: DEFAULT_USER_ID, deviceId: DEFAULT_DEVICE_ID, createdAt: new Date(), ...overrides}
}

/**
 * Create a mock session row with sensible defaults.
 *
 * Defaults to a valid session expiring in 24 hours.
 *
 * @example
 * const session = createMockSession()
 * const expiredSession = createMockSession(\{expiresAt: new Date(Date.now() - 3600000)\})
 */
export function createMockSession(overrides: Partial<SessionRow> = {}): SessionRow {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    id: DEFAULT_SESSION_ID,
    userId: DEFAULT_USER_ID,
    token: 'test-session-token-abcdef123456',
    expiresAt: tomorrow,
    ipAddress: '127.0.0.1',
    userAgent: 'MediaDownloader/1.0 iOS/17.2.1',
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create a mock identity provider row.
 *
 * Defaults to a Sign In With Apple identity with valid tokens.
 *
 * @example
 * const idp = createMockIdentityProvider()
 * const expiredIdp = createMockIdentityProvider(\{expiresAt: Math.floor(Date.now() / 1000) - 3600\})
 */
export function createMockIdentityProvider(overrides: Partial<IdentityProviderRow> = {}): IdentityProviderRow {
  return {
    id: 'idp-1234-5678-9abc-def012345678',
    userId: DEFAULT_USER_ID,
    providerUserId: '001234.abcdef1234567890.1234',
    email: 'private-relay@privaterelay.appleid.com',
    emailVerified: true,
    isPrivateEmail: true,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  }
}

/**
 * Create a mock file download row.
 *
 * Defaults to a pending download with no errors.
 *
 * @example
 * const download = createMockFileDownload()
 * const failedDownload = createMockFileDownload(\{status: 'Failed', lastError: 'Network timeout'\})
 * const retrying = createMockFileDownload(\{retryCount: 2, retryAfter: new Date()\})
 */
export function createMockFileDownload(overrides: Partial<FileDownloadRow> = {}): FileDownloadRow {
  const now = new Date()
  return {
    fileId: DEFAULT_FILE_ID,
    status: 'Pending',
    retryCount: 0,
    maxRetries: 5,
    retryAfter: null,
    errorCategory: null,
    lastError: null,
    scheduledReleaseTime: null,
    sourceUrl: 'https://www.youtube.com/watch?v=' + DEFAULT_FILE_ID,
    correlationId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

/**
 * Create multiple mock files with sequential IDs.
 *
 * Useful for testing list operations.
 *
 * @example
 * const files = createMockFiles(3)  // Creates 3 files with IDs file-1, file-2, file-3
 * const customFiles = createMockFiles(2, \{status: 'Queued'\})  // All files queued
 */
export function createMockFiles(count: number, overrides: Partial<FileRow> = {}): FileRow[] {
  return Array.from({length: count}, (_, i) => createMockFile({fileId: `file-${i + 1}`, title: `Test Video ${i + 1}`, ...overrides}))
}

/**
 * Create multiple mock devices with sequential IDs.
 *
 * Useful for testing multi-device scenarios.
 *
 * @example
 * const devices = createMockDevices(2)
 */
export function createMockDevices(count: number, overrides: Partial<DeviceRow> = {}): DeviceRow[] {
  return Array.from({length: count}, (_, i) => createMockDevice({deviceId: `device-${i + 1}`, name: `Test Device ${i + 1}`, ...overrides}))
}
