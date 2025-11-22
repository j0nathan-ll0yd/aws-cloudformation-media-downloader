import {createEntity, documentClient} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the Devices DynamoDB table.
 * This entity manages device registrations for push notifications.
 */
export const Devices = createEntity(
  {
    model: {
      entity: 'Device',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      deviceId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      name: {
        type: 'string',
        required: true
      },
      token: {
        type: 'string',
        required: true
      },
      systemVersion: {
        type: 'string',
        required: true
      },
      systemName: {
        type: 'string',
        required: true
      },
      endpointArn: {
        type: 'string',
        required: true
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'deviceId',
          composite: ['deviceId']
        }
      }
    }
  },
  {
    table: process.env.DynamoDBTableDevices,
    client: documentClient
  }
)

// Type exports for use in application code
export type DeviceItem = ReturnType<typeof Devices.parse>
export type CreateDeviceInput = Parameters<typeof Devices.create>[0]
export type UpdateDeviceInput = Parameters<typeof Devices.update>[0]
export type UpsertDeviceInput = Parameters<typeof Devices.upsert>[0]
