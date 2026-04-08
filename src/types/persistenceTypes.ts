/**
 * Persistence Relationship Types
 *
 * Types for DynamoDB join table relationships in the single-table design.
 * These represent many-to-many associations between core entities.
 *
 * Single-Table Design:
 * - All entities share one DynamoDB table
 * - GSI1 enables user-centric queries (get all files/devices for user)
 * - GSI2 enables reverse lookups (get all users for a file/device)
 *
 * @see src/entities/UserFiles.ts for file association entity
 * @see src/entities/UserDevices.ts for device association entity
 * @see Collections.ts for JOIN-like queries across entities
 */

/**
 * User-to-Device association.
 *
 * Links a user to one of their registered iOS devices.
 * Enables push notifications for file download progress.
 *
 * Created by: RegisterDevice Lambda
 * Deleted by: UserDelete Lambda (cascade), PruneDevices Lambda (stale cleanup)
 *
 * @see userDevices table in Drizzle schema
 * @see Collections.userResources for batch queries
 */
export interface UserDevice {
  /** User ID (foreign key to Users entity) */
  userId: string
  /** Device ID (foreign key to Devices entity) */
  deviceId: string
  /** Timestamp when relationship was created */
  createdAt?: Date
}

/**
 * User-to-File association.
 *
 * Links a user to a file they have access to.
 * Multiple users can share access to the same file.
 *
 * Created by: WebhookFeedly Lambda (when user subscribes to feed)
 * Deleted by: UserDelete Lambda (cascade deletion)
 *
 * Access patterns:
 * - Query by userId: "Get all files for user" (ListFiles)
 * - Query by fileId: "Get all users for file" (S3ObjectCreated notifications)
 *
 * @see userFiles table in Drizzle schema
 * @see Collections.userResources for batch queries
 */
export interface UserFile {
  /** File ID (YouTube video ID, foreign key to Files entity) */
  fileId: string
  /** User ID (foreign key to Users entity) */
  userId: string
  /** Timestamp when relationship was created */
  createdAt?: Date
}
