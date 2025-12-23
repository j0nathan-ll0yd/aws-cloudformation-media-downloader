import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the UserDevices relationship.
 * This entity manages the many-to-many relationship between users and devices.
 * Each record represents a single user-device association (not a Set).
 *
 * Single-table design enables bidirectional queries via collections:
 * - UserCollection (gsi1): Query all devices for a user
 * - DeviceCollection (gsi3): Query all users for a device
 */
export const UserDevices = new Entity(
  {
    model: {entity: 'UserDevice', version: '1', service: 'MediaDownloader'},
    attributes: {userId: {type: 'string', required: true, readOnly: true}, deviceId: {type: 'string', required: true, readOnly: true}},
    indexes: {
      primary: {pk: {field: 'pk', composite: ['userId', 'deviceId']}, sk: {field: 'sk', composite: []}},
      byUser: {index: 'UserCollection', pk: {field: 'gsi1pk', composite: ['userId']}, sk: {field: 'gsi1sk', composite: ['deviceId']}},
      byDevice: {index: 'DeviceCollection', pk: {field: 'gsi3pk', composite: ['deviceId']}, sk: {field: 'gsi3sk', composite: ['userId']}}
    }
  } as const,
  {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient}
)

// Type exports for use in application code
export type UserDeviceItem = ReturnType<typeof UserDevices.parse>
export type CreateUserDeviceInput = Parameters<typeof UserDevices.create>[0]
export type UpdateUserDeviceInput = Parameters<typeof UserDevices.update>[0]
