/**
 * Device Queries - Native Drizzle ORM queries for device operations.
 *
 * Replaces the ElectroDB-style Devices entity wrapper with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Devices.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {devices} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type DeviceRow = InferSelectModel<typeof devices>

export type CreateDeviceInput = InferInsertModel<typeof devices>
export type UpdateDeviceInput = Partial<Omit<InferInsertModel<typeof devices>, 'deviceId'>>

// Get a device by ID
export async function getDevice(deviceId: string): Promise<DeviceRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Create a new device
export async function createDevice(input: CreateDeviceInput): Promise<DeviceRow> {
  const db = await getDrizzleClient()
  const [device] = await db.insert(devices).values(input).returning()
  return device
}

// Upsert a device (create if not exists, update if exists)
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

// Update a device by ID
export async function updateDevice(deviceId: string, data: UpdateDeviceInput): Promise<DeviceRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(devices).set(data).where(eq(devices.deviceId, deviceId)).returning()
  return updated
}

// Delete a device by ID
export async function deleteDevice(deviceId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(devices).where(eq(devices.deviceId, deviceId))
}
