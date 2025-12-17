import {DynamoDBFile, DownloadReadyNotification, MetadataNotification} from '#types/main'
import {YtDlpVideoInfo} from '#types/youtube'
import {PublishInput} from '#lib/vendor/AWS/SNS'
import {MessageAttributeValue, stringAttribute} from '#lib/vendor/AWS/SQS'

const MAX_DESCRIPTION_LENGTH = 500

// Re-export for backwards compatibility
export { unknownErrorToString } from './lambda-helpers'

/**
 * Truncates description to MAX_DESCRIPTION_LENGTH to fit within APNS payload limits
 */
export function truncateDescription(description: string): string {
  if (!description || description.length <= MAX_DESCRIPTION_LENGTH) return description || ''
  return description.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...'
}

/**
 * Creates MetadataNotification - full details, sent after fetchVideoInfo succeeds
 * @param fileId - The video ID
 * @param videoInfo - Video metadata from yt-dlp
 * @param userId - User ID to send notification to
 * @returns SQS message body and attributes for routing
 */
export function createMetadataNotification(
  fileId: string,
  videoInfo: YtDlpVideoInfo,
  userId: string
): {messageBody: string; messageAttributes: Record<string, MessageAttributeValue>} {
  const file: MetadataNotification = {
    fileId,
    key: `${fileId}.mp4`,
    title: videoInfo.title || '',
    authorName: videoInfo.uploader || 'Unknown',
    authorUser: (videoInfo.uploader || 'unknown').toLowerCase().replace(/\s+/g, '_'),
    description: truncateDescription(videoInfo.description || ''),
    publishDate: videoInfo.upload_date || new Date().toISOString().split('T')[0],
    contentType: 'video/mp4',
    status: 'pending'
  }

  return {
    messageBody: JSON.stringify({file, notificationType: 'MetadataNotification'}),
    messageAttributes: {
      userId: stringAttribute(userId),
      notificationType: stringAttribute('MetadataNotification')
    }
  }
}

/**
 * Creates DownloadReadyNotification - minimal, sent after S3 upload completes
 * @param dbFile - File record from DynamoDB
 * @param userId - User ID to send notification to
 * @returns SQS message body and attributes for routing
 */
export function createDownloadReadyNotification(
  dbFile: DynamoDBFile,
  userId: string
): {messageBody: string; messageAttributes: Record<string, MessageAttributeValue>} {
  const file: DownloadReadyNotification = {
    fileId: dbFile.fileId,
    key: dbFile.key,
    size: dbFile.size,
    url: dbFile.url!
  }

  return {
    messageBody: JSON.stringify({file, notificationType: 'DownloadReadyNotification'}),
    messageAttributes: {
      userId: stringAttribute(userId),
      notificationType: stringAttribute('DownloadReadyNotification')
    }
  }
}

/**
 * Transform SQS message body (JSON) to APNS push notification
 * Supports both MetadataNotification and DownloadReadyNotification types
 * @param messageBody - JSON string containing file and notificationType
 * @param targetArn - SNS endpoint ARN for the device
 * @returns SNS PublishInput for APNS
 */
export function transformToAPNSNotification(messageBody: string, targetArn: string): PublishInput {
  const payload = JSON.parse(messageBody)

  return {
    Message: JSON.stringify({
      APNS_SANDBOX: JSON.stringify({
        aps: {'content-available': 1},
        notificationType: payload.notificationType,
        file: payload.file
      }),
      default: 'Default message'
    }),
    MessageAttributes: {
      'AWS.SNS.MOBILE.APNS.PRIORITY': {DataType: 'String', StringValue: '5'},
      'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {DataType: 'String', StringValue: 'background'}
    },
    MessageStructure: 'json',
    TargetArn: targetArn
  }
}
