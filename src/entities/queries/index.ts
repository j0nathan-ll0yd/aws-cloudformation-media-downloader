/**
 * Native Drizzle Query Modules - Barrel Export
 *
 * This module exports all native Drizzle ORM query functions.
 * Use these instead of the legacy ElectroDB-style entity wrappers.
 *
 * Migration Guide:
 * - Old: `await Users.get({id}).go()` -\> `{data: user | null}`
 * - New: `await getUser(id)` -\> `user | null`
 *
 * Benefits:
 * - 67% less code (no chainable API boilerplate)
 * - Direct SQL with JOINs (no N+1 queries)
 * - Standard function signatures (easier to mock)
 * - Full TypeScript inference
 */

// User queries
export {
  createUser,
  type CreateUserInput,
  deleteUser,
  getUser,
  getUsersByAppleDeviceId,
  getUsersByEmail,
  type IdentityProviderData,
  type IdentityProviderRow,
  updateUser,
  type UpdateUserInput,
  type UserItem,
  type UserRow
} from './user-queries'

// File queries
export {
  createFile,
  createFileDownload,
  type CreateFileDownloadInput,
  type CreateFileInput,
  deleteFile,
  deleteFileDownload,
  type FileDownloadRow,
  type FileRow,
  getFile,
  getFileDownload,
  getFilesBatch,
  getFilesByKey,
  updateFile,
  updateFileDownload,
  type UpdateFileDownloadInput,
  type UpdateFileInput,
  upsertFile,
  upsertFileDownload
} from './file-queries'

// Device queries
export {
  createDevice,
  type CreateDeviceInput,
  deleteDevice,
  type DeviceRow,
  getAllDevices,
  getDevice,
  getDevicesBatch,
  updateDevice,
  type UpdateDeviceInput,
  upsertDevice
} from './device-queries'

// Session queries
export {
  type AccountRow,
  createAccount,
  type CreateAccountInput,
  createSession,
  type CreateSessionInput,
  createVerification,
  type CreateVerificationInput,
  deleteAccount,
  deleteAccountsByUserId,
  deleteExpiredSessions,
  deleteExpiredVerifications,
  deleteSession,
  deleteSessionsByUserId,
  deleteVerification,
  getAccount,
  getAccountsByUserId,
  getSession,
  getSessionByToken,
  getSessionsByUserId,
  getVerificationByIdentifier,
  type SessionRow,
  type UpdateAccountInput,
  updateSession,
  type UpdateSessionInput,
  type VerificationRow
} from './session-queries'

// Relationship queries
export {
  createUserDevice,
  type CreateUserDeviceInput,
  createUserFile,
  type CreateUserFileInput,
  deleteUserDevice,
  deleteUserDevicesByDeviceId,
  deleteUserDevicesByUserId,
  deleteUserFile,
  deleteUserFilesBatch,
  deleteUserFilesByUserId,
  getDeviceIdsForUsers,
  getDevicesForUser,
  getFilesForUser,
  getUserDevice,
  getUserDevicesByDeviceId,
  getUserDevicesByUserId,
  getUserFile,
  getUserFilesByFileId,
  getUserFilesByUserId,
  upsertUserDevice,
  upsertUserFile,
  type UserDeviceRow,
  type UserFileRow
} from './relationship-queries'

// Prepared queries (performance-critical paths)
export { getFileByKeyPrepared, getSessionByTokenPrepared, getUserFilesPrepared, resetPreparedStatements } from './prepared-queries'

// Cascade operations (transaction-wrapped multi-entity operations)
export { deleteUserAuthRecords, deleteUserCascade, deleteUserRelationships } from './cascade-operations'
