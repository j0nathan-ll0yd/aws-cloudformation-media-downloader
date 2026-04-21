/**
 * S3 Notification Service
 *
 * Handles file lookup, user discovery, and notification dispatch
 * for S3 object creation events.
 */
import {getFilesByKey, getUserFilesByFileId} from '#entities/queries'
import {sendMessage} from '@mantleframework/aws'
import {logDebug, logError, logInfo} from '@mantleframework/observability'
import type {File} from '#types/domainModels'
import {createDownloadReadyNotification} from '#services/notification/transformers'
import {NotFoundError} from '@mantleframework/errors'
import {getRequiredEnv} from '@mantleframework/env'

/** Get file by S3 object key */
export async function getFileByFilename(fileName: string): Promise<File> {
  logDebug('query file by key <=', {fileName})
  const files = await getFilesByKey(fileName)
  logDebug('query file by key =>', {count: files.length})
  if (files.length > 0) {
    return files[0] as File
  } else {
    throw new NotFoundError('Unable to locate file')
  }
}

/** Get user IDs who have requested a given file */
export async function getUsersOfFile(file: File): Promise<string[]> {
  logDebug('query users by fileId <=', {fileId: file.fileId})
  const userFiles = await getUserFilesByFileId(file.fileId)
  logDebug('query users by fileId =>', {count: userFiles.length})
  return userFiles.map((userFile) => userFile.userId)
}

/** Dispatches DownloadReadyNotification to a user via SQS */
export function dispatchFileNotificationToUser(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNS_QUEUE_URL')}
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/** Log results of notification dispatch and emit metrics */
export function logDispatchResults(results: PromiseSettledResult<unknown>[], userIds: string[], fileId: string): {succeeded: number; failed: number} {
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failedResults = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

  if (failedResults.length > 0) {
    failedResults.forEach((failure) => {
      const userId = userIds[results.indexOf(failure)]
      logError('Failed to dispatch notification', {fileId, userId, error: failure.reason instanceof Error ? failure.reason.message : String(failure.reason)})
    })
    logInfo('S3ObjectCreated completed with partial failures', {fileId, totalUsers: userIds.length, succeeded, failed: failedResults.length})
  } else {
    logInfo('All notifications dispatched successfully', {fileId, userCount: userIds.length})
  }

  return {succeeded, failed: failedResults.length}
}
