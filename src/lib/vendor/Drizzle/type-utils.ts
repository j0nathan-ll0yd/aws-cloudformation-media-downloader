/**
 * Drizzle-to-Domain Type Utilities
 *
 * Provides type-safe conversion between Drizzle row types and domain types.
 * Use these utilities at service boundaries to ensure type safety.
 *
 * @see src/types/domain-models.d.ts for domain type definitions
 * @see src/entities/queries/ for Drizzle row types
 */
import type {UserRow} from '#entities/queries/userQueries'
import type {FileRow} from '#entities/queries/fileQueries'
import type {DeviceRow} from '#entities/queries/deviceQueries'
import type {UserDeviceRow, UserFileRow} from '#entities/queries/relationshipQueries'
import type {Device, File, User} from '#types/domainModels'
import type {UserDevice, UserFile} from '#types/persistenceTypes'
import {FileStatus} from '#types/enums'

/**
 * Converts a Drizzle UserRow to a domain User type.
 * Includes all fields from the database schema.
 * @param row - The Drizzle user row from database query
 * @returns Domain User object with all schema fields
 */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    name: row.name ?? undefined,
    image: row.image ?? undefined,
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined,
    appleDeviceId: row.appleDeviceId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

/**
 * Converts a Drizzle FileRow to a domain File type.
 * Maps the string status to FileStatus enum.
 * @param row - The Drizzle file row from database query
 * @returns Domain File object with proper status enum
 */
export function toFile(row: FileRow): File {
  return {
    fileId: row.fileId,
    size: row.size,
    authorName: row.authorName,
    authorUser: row.authorUser,
    publishDate: row.publishDate,
    description: row.description,
    key: row.key,
    url: row.url ?? undefined,
    contentType: row.contentType,
    title: row.title,
    status: row.status as FileStatus
  }
}

/**
 * Converts a Drizzle DeviceRow to a domain Device type.
 * All fields are required in both types.
 * @param row - The Drizzle device row from database query
 * @returns Domain Device object
 */
export function toDevice(row: DeviceRow): Device {
  return {
    deviceId: row.deviceId,
    name: row.name,
    token: row.token,
    systemVersion: row.systemVersion,
    systemName: row.systemName,
    endpointArn: row.endpointArn
  }
}

/**
 * Converts a Drizzle UserFileRow to a domain UserFile type.
 * Includes the createdAt timestamp from the relationship.
 * @param row - The Drizzle user-file relationship row
 * @returns Domain UserFile object
 */
export function toUserFile(row: UserFileRow): UserFile {
  return {userId: row.userId, fileId: row.fileId, createdAt: row.createdAt}
}

/**
 * Converts a Drizzle UserDeviceRow to a domain UserDevice type.
 * Includes the createdAt timestamp from the relationship.
 * @param row - The Drizzle user-device relationship row
 * @returns Domain UserDevice object
 */
export function toUserDevice(row: UserDeviceRow): UserDevice {
  return {userId: row.userId, deviceId: row.deviceId, createdAt: row.createdAt}
}
