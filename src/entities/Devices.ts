import {
  documentClient,
  Entity
} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Devices DynamoDB table.
 * This entity manages device registrations for push notifications.
 */
export const Devices = new Entity(
  {
    model: { entity: 'Device', version: '1', service: 'MediaDownloader' },
    attributes: {
      deviceId: { type: 'string', required: true, readOnly: true },
      name: { type: 'string', required: true },
      token: { type: 'string', required: true },
      systemVersion: { type: 'string', required: true },
      systemName: { type: 'string', required: true },
      endpointArn: { type: 'string', required: true }
    },
    indexes: {
      primary: { pk: { field: 'pk', composite: ['deviceId'] }, sk: { field: 'sk', composite: [] } }
    }
  } as const,
  { table: process.env.DynamoDBTableName, client: documentClient }
)

// Type exports for use in application code
export type DeviceItem = ReturnType<typeof Devices.parse>
export type CreateDeviceInput = Parameters<typeof Devices.create>[0]
export type UpdateDeviceInput = Parameters<typeof Devices.update>[0]
export type UpsertDeviceInput = Parameters<typeof Devices.upsert>[0]
