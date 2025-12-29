/**
 * Device Queries - Native Drizzle ORM queries for device operations.
 *
 * Replaces the ElectroDB-style Devices entity wrapper with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Devices.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {eq, inArray} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {devices} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type DeviceRow = InferSelectModel<typeof devices>

export type CreateDeviceInput = InferInsertModel<typeof devices>
export type UpdateDeviceInput = Partial<Omit<InferInsertModel<typeof devices>, 'deviceId'>>

/**
 * Gets a device by ID.
 * @param deviceId - The device's unique identifier
 * @returns The device row or null if not found
 */
export async function getDevice(deviceId: string): Promise<DeviceRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets multiple devices by IDs (batch operation).
 * @param deviceIds - Array of device IDs to retrieve
 * @returns Array of device rows
 */
export async function getDevicesBatch(deviceIds: string[]): Promise<DeviceRow[]> {
  if (deviceIds.length === 0) {
    return []
  }
  const db = await getDrizzleClient()
  return await db.select().from(devices).where(inArray(devices.deviceId, deviceIds))
}

/**
 * Creates a new device.
 * @param input - The device data to create
 * @returns The created device row
 */
export async function createDevice(input: CreateDeviceInput): Promise<DeviceRow> {
  const db = await getDrizzleClient()
  const [device] = await db.insert(devices).values(input).returning()
  return device
}

/**
 * Upserts a device (create if not exists, update if exists).
 * @param input - The device data to upsert
 * @returns The created or updated device row
 */
export async function upsertDevice(input: CreateDeviceInput): Promise<DeviceRow> {
  const db = await getDrizzleClient()

  const existing = await db.select().from(devices).where(eq(devices.deviceId, input.deviceId)).limit(1)

  if (existing.length > 0) {
    const [updated] = await db.update(devices).set(input).where(eq(devices.deviceId, input.deviceId)).returning()
    return updated
  }

  const [created] = await db.insert(devices).values(input).returning()
  return created
}

/**
 * Updates a device by ID.
 * @param deviceId - The device's unique identifier
 * @param data - The fields to update
 * @returns The updated device row
 */
export async function updateDevice(deviceId: string, data: UpdateDeviceInput): Promise<DeviceRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(devices).set(data).where(eq(devices.deviceId, deviceId)).returning()
  return updated
}

/**
 * Deletes a device by ID.
 * @param deviceId - The device's unique identifier
 */
export async function deleteDevice(deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(devices).where(eq(devices.deviceId, deviceId))
}

/**
 * Gets all devices (for scheduled jobs like PruneDevices).
 * @returns Array of all device rows
 */
export async function getAllDevices(): Promise<DeviceRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(devices)
}
