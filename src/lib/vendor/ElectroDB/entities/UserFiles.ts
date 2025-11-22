import {Entity} from 'electrodb'
import {documentClient} from '../client'


/**
 * ElectroDB entity schema for the UserFiles DynamoDB table.
 * This entity manages the many-to-many relationship between users and files.
 * Uses a DynamoDB Set to store multiple fileIds per user.
 */
export const UserFiles = new Entity({
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
}, {
  table: process.env.DynamoDBTableUserFiles,
  client: documentClient
})

// Type exports for use in application code
export type UserFileItem = ReturnType<typeof UserFiles.parse>
export type CreateUserFileInput = Parameters<typeof UserFiles.create>[0]
export type UpdateUserFileInput = Parameters<typeof UserFiles.update>[0]

/**
 * Helper function to add a file to a user's file set (atomic operation)
 * This mimics the DynamoDB ADD operation for sets
 */
export async function addFileToUser(userId: string, fileId: string) {
  // First, get the current record (if it exists)
  const existing = await UserFiles.get({userId}).go()

  if (existing.data) {
    // Update existing record by adding to the set
    const currentFiles = existing.data.fileId || []
    const updatedFiles = Array.from(new Set([...currentFiles, fileId]))
    return UserFiles.update({userId}).set({fileId: updatedFiles}).go()
  } else {
    // Create new record with the file
    return UserFiles.create({
      userId,
      fileId: [fileId]
    }).go()
  }
}

/**
 * Helper function to remove a file from a user's file set (atomic operation)
 * This mimics the DynamoDB DELETE operation for sets
 */
export async function removeFileFromUser(userId: string, fileId: string) {
  const existing = await UserFiles.get({userId}).go()

  if (existing.data && existing.data.fileId) {
    const updatedFiles = existing.data.fileId.filter((id) => id !== fileId)
    return UserFiles.update({userId}).set({fileId: updatedFiles}).go()
  }

  return existing
}
