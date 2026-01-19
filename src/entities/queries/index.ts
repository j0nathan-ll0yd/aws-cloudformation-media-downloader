/**
 * Drizzle Query Modules - Barrel Export
 *
 * This module exports all Drizzle ORM query functions.
 * These are the primary interface for all database operations.
 *
 * Benefits:
 * - Direct SQL with JOINs (no N+1 queries)
 * - Standard function signatures (easy to mock)
 * - Full TypeScript inference
 */

// User queries
export {
  createUser,
  type CreateUserInput,
  deleteUser,
  getUser,
  getUsersByEmail,
  updateUser,
  type UpdateUserInput,
  type UserItem,
  UserQueries,
  type UserRow
} from './userQueries'

// File queries
export {
  createFile,
  createFileDownload,
  type CreateFileDownloadInput,
  type CreateFileInput,
  deleteFile,
  deleteFileDownload,
  type FileDownloadRow,
  FileQueries,
  type FileRow,
  getFile,
  getFileDownload,
  getFilesBatch,
  getFilesByKey,
  getFileStatus,
  updateFile,
  updateFileDownload,
  type UpdateFileDownloadInput,
  type UpdateFileInput,
  upsertFile,
  upsertFileDownload
} from './fileQueries'

// Device queries
export {
  createDevice,
  type CreateDeviceInput,
  deleteDevice,
  DeviceQueries,
  type DeviceRow,
  getAllDevices,
  getDevice,
  getDevicesBatch,
  updateDevice,
  type UpdateDeviceInput,
  upsertDevice
} from './deviceQueries'

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
  SessionQueries,
  type SessionRow,
  type UpdateAccountInput,
  updateSession,
  type UpdateSessionInput,
  type VerificationRow
} from './sessionQueries'

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
  getUserDeviceIdsByUserId,
  getUserDevicesByDeviceId,
  getUserDevicesByUserId,
  getUserFile,
  getUserFileIdsByUserId,
  getUserFilesByFileId,
  getUserFilesByUserId,
  RelationshipQueries,
  upsertUserDevice,
  upsertUserFile,
  type UserDeviceRow,
  type UserFileRow
} from './relationshipQueries'

// Prepared queries (performance-critical paths)
export { getFileByKeyPrepared, getSessionByTokenPrepared, getUserFilesPrepared, PreparedQueries, resetPreparedStatements } from './preparedQueries'

// Cascade operations (transaction-wrapped multi-entity operations)
export { CascadeOperations, deleteUserAuthRecords, deleteUserCascade, deleteUserRelationships } from './cascadeOperations'
