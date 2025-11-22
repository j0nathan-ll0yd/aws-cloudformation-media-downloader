import {Entity} from 'electrodb'
import {documentClient} from '../lib/vendor/AWS/DynamoDB'

/**
 * ElectroDB entity schema for the UserDevices DynamoDB table.
 * This entity manages the many-to-many relationship between users and devices.
 * Uses a DynamoDB Set to store multiple deviceIds per user.
 */
export const UserDevices = new Entity(
  {
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
  },
  {
    table: process.env.DynamoDBTableUserDevices,
    client: documentClient
  }
)

// Type exports for use in application code
export type UserDeviceItem = ReturnType<typeof UserDevices.parse>
export type CreateUserDeviceInput = Parameters<typeof UserDevices.create>[0]
export type UpdateUserDeviceInput = Parameters<typeof UserDevices.update>[0]
