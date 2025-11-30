import {documentClient, Entity} from '../lib/vendor/ElectroDB/entity'

/**
 * ElectroDB entity schema for the UserFiles relationship.
 * This entity manages the many-to-many relationship between users and files.
 * Each record represents a single user-file association (not a Set).
 *
 * Single-table design enables bidirectional queries via collections:
 * - UserCollection (gsi1): Query all files for a user
 * - FileCollection (gsi2): Query all users for a file
 */
export const UserFiles = new Entity(
  {
    model: { entity: 'UserFile', version: '1', service: 'MediaDownloader' },
    attributes: {
      userId: { type: 'string', required: true, readOnly: true },
      fileId: { type: 'string', required: true, readOnly: true }
    },
    indexes: {
      primary: { pk: { field: 'pk', composite: ['userId', 'fileId'] }, sk: { field: 'sk', composite: [] } },
      byUser: {
        index: 'UserCollection',
        pk: { field: 'gsi1pk', composite: ['userId'] },
        sk: { field: 'gsi1sk', composite: ['fileId'] }
      },
      byFile: {
        index: 'FileCollection',
        pk: { field: 'gsi2pk', composite: ['fileId'] },
        sk: { field: 'gsi2sk', composite: ['userId'] }
      }
    }
  } as const,
  { table: process.env.DynamoDBTableName, client: documentClient }
)

// Type exports for use in application code
export type UserFileItem = ReturnType<typeof UserFiles.parse>
export type CreateUserFileInput = Parameters<typeof UserFiles.create>[0]
export type UpdateUserFileInput = Parameters<typeof UserFiles.update>[0]
