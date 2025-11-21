import {Entity} from 'electrodb'

/**
 * ElectroDB entity schema for the UserDevices DynamoDB table.
 * This entity manages the many-to-many relationship between users and devices.
 * Uses a DynamoDB Set to store multiple deviceIds per user.
 */
export const UserDevices = new Entity({
  model: {
    entity: 'UserDevice',
    version: '1',
    service: 'MediaDownloader'
  },
  attributes: {
    userId: {
      type: 'string',
      required: true,
      readOnly: true
    },
    devices: {
      type: 'set',
      items: 'string',
      required: false,
      default: []
    }
  },
  indexes: {
    primary: {
      pk: {
        field: 'userId',
        composite: ['userId']
      }
    }
  }
})

// Type exports for use in application code
export type UserDeviceItem = ReturnType<typeof UserDevices.parse>
export type CreateUserDeviceInput = Parameters<typeof UserDevices.create>[0]
export type UpdateUserDeviceInput = Parameters<typeof UserDevices.update>[0]

/**
 * Helper function to add a device to a user's device set (atomic operation)
 * This mimics the DynamoDB ADD operation for sets
 */
export async function addDeviceToUser(userId: string, deviceId: string) {
  // First, get the current record (if it exists)
  const existing = await UserDevices.get({userId}).go()

  if (existing.data) {
    // Update existing record by adding to the set
    const currentDevices = existing.data.devices || []
    const updatedDevices = Array.from(new Set([...currentDevices, deviceId]))
    return UserDevices.update({userId})
      .set({devices: updatedDevices})
      .go()
  } else {
    // Create new record with the device
    return UserDevices.create({
      userId,
      devices: [deviceId]
    }).go()
  }
}

/**
 * Helper function to remove a device from a user's device set (atomic operation)
 * This mimics the DynamoDB DELETE operation for sets
 */
export async function removeDeviceFromUser(userId: string, deviceId: string) {
  const existing = await UserDevices.get({userId}).go()

  if (existing.data && existing.data.devices) {
    const updatedDevices = existing.data.devices.filter(id => id !== deviceId)
    return UserDevices.update({userId})
      .set({devices: updatedDevices})
      .go()
  }

  return existing
}