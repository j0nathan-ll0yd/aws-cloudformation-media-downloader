/**
 * UserDevices Entity - Many-to-many relationship between users and devices.
 *
 * Each record represents a single user-device association.
 * Enables bidirectional queries via indexes.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Access Patterns:
 * - byUser: Query all devices for a user
 * - byDevice: Query all users for a device
 *
 * @see RegisterDevice Lambda for device registration
 * @see SendPushNotification Lambda for notification delivery
 * @see PruneDevices Lambda for stale device cleanup
 * @see UserDelete Lambda for cascade deletion
 */
import {and, eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {userDevices} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type UserDeviceItem = InferSelectModel<typeof userDevices>
export type CreateUserDeviceInput = Omit<InferInsertModel<typeof userDevices>, 'createdAt'>
export type UpdateUserDeviceInput = Partial<Omit<InferInsertModel<typeof userDevices>, 'userId' | 'deviceId'>>

// Overloaded delete function
function userDevicesDelete(
  key: Array<{userId: string; deviceId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{unprocessed: Array<{userId: string; deviceId: string}>}>}
function userDevicesDelete(key: {userId: string; deviceId: string}): {go: () => Promise<Record<string, never>>}
function userDevicesDelete(key: {userId: string; deviceId: string} | Array<{userId: string; deviceId: string}>) {
  if (Array.isArray(key)) {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        for (const k of key) {
          await db.delete(userDevices).where(and(eq(userDevices.userId, k.userId), eq(userDevices.deviceId, k.deviceId)))
        }
        return {unprocessed: []}
      }
    }
  }
  return {
    go: async () => {
      const db = await getDrizzleClient()
      await db.delete(userDevices).where(and(eq(userDevices.userId, key.userId), eq(userDevices.deviceId, key.deviceId)))
      return {}
    }
  }
}

export const UserDevices = {
  get(key: {userId: string; deviceId: string}): {go: () => Promise<{data: UserDeviceItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(userDevices).where(and(eq(userDevices.userId, key.userId), eq(userDevices.deviceId, key.deviceId))).limit(1)

        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateUserDeviceInput): {go: () => Promise<{data: UserDeviceItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const [userDevice] = await db.insert(userDevices).values(input).returning()
        return {data: userDevice}
      }
    }
  },

  upsert(input: CreateUserDeviceInput): {go: () => Promise<{data: UserDeviceItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()

        const existing = await db.select().from(userDevices).where(and(eq(userDevices.userId, input.userId), eq(userDevices.deviceId, input.deviceId)))
          .limit(1)

        if (existing.length > 0) {
          return {data: existing[0]}
        }

        const [created] = await db.insert(userDevices).values(input).returning()
        return {data: created}
      }
    }
  },

  delete: userDevicesDelete,

  query: {
    byUser(key: {userId: string}): {go: () => Promise<{data: UserDeviceItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(userDevices).where(eq(userDevices.userId, key.userId))
          return {data: result}
        }
      }
    },

    byDevice(key: {deviceId: string}): {go: () => Promise<{data: UserDeviceItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(userDevices).where(eq(userDevices.deviceId, key.deviceId))
          return {data: result}
        }
      }
    }
  }
}
