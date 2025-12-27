/**
 * Devices Entity - iOS device registration for push notifications.
 *
 * Stores APNS device tokens and SNS endpoint ARNs.
 * Lifecycle managed by RegisterDevice and PruneDevices Lambdas.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Access Patterns:
 * - Primary: Get device by deviceId
 * - Batch get: Get multiple devices by deviceId array
 *
 * @see RegisterDevice Lambda for device registration
 * @see PruneDevices Lambda for stale device cleanup
 * @see SendPushNotification Lambda for notification delivery
 */
import {eq, inArray} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {devices} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type DeviceItem = InferSelectModel<typeof devices>
export type CreateDeviceInput = InferInsertModel<typeof devices>
export type UpdateDeviceInput = Partial<Omit<InferInsertModel<typeof devices>, 'deviceId'>>
export type UpsertDeviceInput = InferInsertModel<typeof devices>

// Overloaded get function
function devicesGet(
  key: Array<{deviceId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{data: DeviceItem[]; unprocessed: Array<{deviceId: string}>}>}
function devicesGet(key: {deviceId: string}): {go: () => Promise<{data: DeviceItem | null}>}
function devicesGet(
  key: {deviceId: string} | Array<{deviceId: string}>
): {go: (options?: {concurrency?: number}) => Promise<{data: DeviceItem | DeviceItem[] | null; unprocessed?: Array<{deviceId: string}>}>} {
  if (Array.isArray(key)) {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const deviceIds = key.map((k) => k.deviceId)
        const result = await db.select().from(devices).where(inArray(devices.deviceId, deviceIds))
        return {data: result, unprocessed: []}
      }
    }
  }
  return {
    go: async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(devices).where(eq(devices.deviceId, key.deviceId)).limit(1)
      return {data: result.length > 0 ? result[0] : null}
    }
  }
}

export const Devices = {
  get: devicesGet,

  create(input: CreateDeviceInput): {go: () => Promise<{data: DeviceItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const [device] = await db.insert(devices).values(input).returning()
        return {data: device}
      }
    }
  },

  upsert(input: UpsertDeviceInput): {go: () => Promise<{data: DeviceItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()

        const existing = await db.select().from(devices).where(eq(devices.deviceId, input.deviceId)).limit(1)

        if (existing.length > 0) {
          const [updated] = await db.update(devices).set(input).where(eq(devices.deviceId, input.deviceId)).returning()
          return {data: updated}
        }

        const [created] = await db.insert(devices).values(input).returning()
        return {data: created}
      }
    }
  },

  update(key: {deviceId: string}): {set: (data: UpdateDeviceInput) => {go: () => Promise<{data: DeviceItem}>}} {
    return {
      set: (data: UpdateDeviceInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const [updated] = await db.update(devices).set(data).where(eq(devices.deviceId, key.deviceId)).returning()
          return {data: updated}
        }
      })
    }
  },

  delete(key: {deviceId: string}): {go: () => Promise<Record<string, never>>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(devices).where(eq(devices.deviceId, key.deviceId))
        return {}
      }
    }
  },

  scan: {
    go: async (options?: {cursor?: string}): Promise<{data: DeviceItem[]; cursor?: string | null}> => {
      // Aurora DSQL returns all results in one query - no pagination needed
      // Options kept for ElectroDB API compatibility
      void options
      const db = await getDrizzleClient()
      const result = await db.select().from(devices)
      return {data: result, cursor: null}
    }
  }
}
