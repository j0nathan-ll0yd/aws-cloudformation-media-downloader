/**
 * S3ObjectCreated Lambda
 *
 * Handles S3 object creation events when videos are uploaded.
 * Updates file records and queues push notifications for users.
 *
 * Trigger: S3 Event (s3:ObjectCreated)
 * Input: S3Event with object creation records
 * Output: void (processes all records, logs errors)
 *
 * @see {@link ../../../services/notification/s3NotificationService.ts} for dispatch logic
 */
import {defineS3Handler} from '@mantleframework/core'
import {addAnnotation, addMetadata, endSpan, logInfo, metrics, MetricUnit, startSpan} from '@mantleframework/observability'
import {dispatchFileNotificationToUser, getFileByFilename, getUsersOfFile, logDispatchResults} from '#services/notification/s3NotificationService'

const s3 = defineS3Handler({operationName: 'S3ObjectCreated', trigger: 'direct', bucket: 'files'})

export const handler = s3(async (record) => {
  const fileName = record.key
  const span = startSpan('s3-event-process')
  addAnnotation(span, 's3Key', fileName)

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

    const results = await Promise.allSettled(userIds.map((userId) => dispatchFileNotificationToUser(file, userId)))
    const {succeeded, failed} = logDispatchResults(results, userIds, file.fileId)

    metrics.addMetric('NotificationsSent', MetricUnit.Count, succeeded)
    addMetadata(span, 'notificationsSent', succeeded)
    addMetadata(span, 'notificationsFailed', failed)

    if (failed > 0) {
      metrics.addMetric('NotificationsFailed', MetricUnit.Count, failed)
    }
    endSpan(span)
  } catch (error) {
    endSpan(span, error as Error)
    throw error
  }
})
