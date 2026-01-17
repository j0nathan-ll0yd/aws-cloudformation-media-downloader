/**
 * S3ObjectCreated Lambda
 *
 * Handles S3 object creation events when videos are uploaded.
 * Updates file records and queues push notifications for users.
 *
 * Trigger: S3 Event (s3:ObjectCreated)
 * Input: S3Event with object creation records
 * Output: void (processes all records, logs errors)
 */
import {getFilesByKey, getUserFilesByFileId} from '#entities/queries'
import {sendMessage} from '#lib/vendor/AWS/SQS'
import type {SendMessageRequest} from '#lib/vendor/AWS/SQS'
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
import {DatabaseOperation, DatabaseTable} from '#types/databasePermissions'
import type {File} from '#types/domainModels'
import {metrics, MetricUnit, RequiresDatabase, S3EventHandler} from '#lib/lambda/handlers'
import type {S3RecordContext} from '#lib/lambda/handlers'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import {createDownloadReadyNotification} from '#lib/services/notification/transformers'
import {NotFoundError} from '#lib/system/errors'
import {getRequiredEnv} from '#lib/system/env'
import {appendCorrelationToLogger, extractCorrelationFromS3Record} from '#lib/lambda/middleware/correlation'

// Get file by S3 object key
async function getFileByFilename(fileName: string): Promise<File> {
  logDebug('query file by key <=', fileName)
  const files = await getFilesByKey(fileName)
  logDebug('query file by key =>', files)
  if (files.length > 0) {
    return files[0] as File
  } else {
    throw new NotFoundError('Unable to locate file')
  }
}

// Get user IDs who have requested a given file
async function getUsersOfFile(file: File): Promise<string[]> {
  logDebug('query users by fileId <=', file.fileId)
  const userFiles = await getUserFilesByFileId(file.fileId)
  logDebug('query users by fileId =>', userFiles)
  return userFiles.map((userFile) => userFile.userId)
}

/**
 * Dispatches DownloadReadyNotification to a user via SQS.
 *
 * @param file - The DynamoDBFile that is now ready to download
 * @param userId - The UUID of the user
 * @returns Promise from sending the SQS message
 * @notExported
 */
function dispatchFileNotificationToUser(file: File, userId: string) {
  const {messageBody, messageAttributes} = createDownloadReadyNotification(file, userId)
  const sendMessageParams: SendMessageRequest = {MessageBody: messageBody, MessageAttributes: messageAttributes, QueueUrl: getRequiredEnv('SNS_QUEUE_URL')}
  logDebug('sendMessage <=', sendMessageParams)
  return sendMessage(sendMessageParams)
}

/**
 * Handler for S3 object creation events.
 * Dispatches download-ready notifications to all users waiting for the file.
 */
@RequiresDatabase({
  tables: [
    {table: DatabaseTable.Files, operations: [DatabaseOperation.Select]},
    {table: DatabaseTable.UserFiles, operations: [DatabaseOperation.Select]}
  ]
})
class S3ObjectCreatedHandler extends S3EventHandler {
  readonly operationName = 'S3ObjectCreated'

  protected async processRecord({record}: S3RecordContext): Promise<void> {
    // Extract and set correlation ID for all subsequent logs
    const correlationId = extractCorrelationFromS3Record(record)
    appendCorrelationToLogger(correlationId)

    const fileName = decodeURIComponent(record.s3.object.key).replace(/\+/g, ' ')
    const span = startSpan('s3-event-process')
    addAnnotation(span, 's3Key', fileName)
    if (correlationId) {
      addAnnotation(span, 'correlationId', correlationId)
    }

    try {
      const file = await getFileByFilename(fileName)
      addAnnotation(span, 'fileId', file.fileId)
      const userIds = await getUsersOfFile(file)
      addMetadata(span, 'userCount', userIds.length)

      if (userIds.length === 0) {
        logInfo('No users to notify for file', {fileId: file.fileId, fileName})
        endSpan(span)
        return
      }

      // Use allSettled to continue processing even if some notifications fail
      const results = await Promise.allSettled(userIds.map((userId) => dispatchFileNotificationToUser(file, userId)))

      // Track results for observability
      const succeeded = results.filter((r) => r.status === 'fulfilled')
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

      // Emit CloudWatch metrics
      metrics.addMetric('NotificationsSent', MetricUnit.Count, succeeded.length)
      addMetadata(span, 'notificationsSent', succeeded.length)
      addMetadata(span, 'notificationsFailed', failed.length)

      if (failed.length > 0) {
        metrics.addMetric('NotificationsFailed', MetricUnit.Count, failed.length)

        // Log each failure with userId for debugging
        failed.forEach((failure) => {
          // Find the original userId by matching the index in the results array
          const userId = userIds[results.indexOf(failure)]
          logError('Failed to dispatch notification', {
            fileId: file.fileId,
            userId,
            error: failure.reason instanceof Error ? failure.reason.message : String(failure.reason)
          })
        })

        logInfo('S3ObjectCreated completed with partial failures', {
          fileId: file.fileId,
          totalUsers: userIds.length,
          succeeded: succeeded.length,
          failed: failed.length
        })
      } else {
        logInfo('All notifications dispatched successfully', {fileId: file.fileId, userCount: userIds.length})
      }
      endSpan(span)
    } catch (error) {
      endSpan(span, error as Error)
      throw error
    }
  }
}

const handlerInstance = new S3ObjectCreatedHandler()
export const handler = handlerInstance.handler.bind(handlerInstance)
