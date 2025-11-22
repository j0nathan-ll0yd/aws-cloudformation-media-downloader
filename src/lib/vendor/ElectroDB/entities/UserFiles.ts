import {Entity} from 'electrodb'
import {documentClient} from '../client'

/**
 * ElectroDB entity schema for the UserFiles DynamoDB table.
 * This entity manages the many-to-many relationship between users and files.
 * Uses a DynamoDB Set to store multiple fileIds per user.
 */
export const UserFiles = new Entity(
  {
    model: {
      entity: 'UserFile',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      userId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      fileId: {
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
    table: process.env.DynamoDBTableUserFiles,
    client: documentClient
  }
)

// Type exports for use in application code
export type UserFileItem = ReturnType<typeof UserFiles.parse>
export type CreateUserFileInput = Parameters<typeof UserFiles.create>[0]
export type UpdateUserFileInput = Parameters<typeof UserFiles.update>[0]
