/**
 * User-File Helper Functions
 *
 * Shared utilities for managing user-file relationships across multiple Lambda functions.
 * Handles file associations, ownership, and sharing operations.
 */
import {UserFiles} from '#entities/UserFiles'
import {logDebug} from './logging'

/**
 * Associates a File to a User by creating a UserFile record
 * Creates individual record for the user-file relationship
 * Idempotent - returns gracefully if association already exists
 * @param fileId - The unique file identifier
 * @param userId - The UUID of the user
 * @see {@link lambdas/WebhookFeedly/src!#handler | WebhookFeedly }
 */
export async function associateFileToUser(fileId: string, userId: string) {
  logDebug('associateFileToUser <=', {fileId, userId})
  try {
    const response = await UserFiles.create({userId, fileId}).go()
    logDebug('associateFileToUser =>', response)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.includes('The conditional request failed')) {
      logDebug('associateFileToUser => already exists (idempotent)')
      return
    }
    throw error
  }
}
