import {ClientFile, DynamoDBFile, FileNotification} from '../types/main'
import {logError} from './lambda-helpers'
import {UnexpectedError} from './errors'
import {PublishInput} from '../lib/vendor/AWS/SNS'
import {stringAttribute, numberAttribute, MessageAttributeValue} from '../lib/vendor/AWS/SQS'

/**
 * Creates SQS message attributes for file notifications
 * Uses vendor wrapper helpers for clean, type-safe attribute creation
 * @param file - File object from ElectroDB query
 * @param userId - User ID to send notification to
 * @returns SQS message attributes for file notification
 */
export function createFileNotificationAttributes(file: DynamoDBFile, userId: string): Record<string, MessageAttributeValue> {
  return {
    fileId: stringAttribute(file.fileId),
    key: stringAttribute(file.key),
    publishDate: stringAttribute(file.publishDate),
    size: numberAttribute(file.size),
    url: stringAttribute(file.url!),
    userId: stringAttribute(userId)
  }
}

export function unknownErrorToString(unknownVariable: unknown): string {
  if (typeof unknownVariable === 'string') {
    return unknownVariable
  } else if (Array.isArray(unknownVariable)) {
    return unknownVariable
      .map(function (s) {
        return unknownErrorToString(s)
      })
      .join(', ')
  } else if (typeof unknownVariable === 'object') {
    return JSON.stringify(unknownVariable)
  } else {
    return 'Unknown error'
  }
}

export function transformFileNotificationToPushNotification(file: FileNotification, targetArn: string): PublishInput {
  const keys: (keyof typeof file)[] = ['fileId', 'key', 'publishDate', 'size', 'url']
  keys.forEach((key) => {
    if (!file[key] || !file[key].stringValue || typeof file[key].stringValue !== 'string') {
      throw new UnexpectedError(`Missing required value in FileNotification: ${key}`)
    }
  })

  const clientFile: ClientFile = {
    fileId: file.fileId.stringValue!,
    key: file.key.stringValue!,
    publishDate: file.publishDate.stringValue!,
    size: parseInt(file.size.stringValue!, 0),
    url: file.url.stringValue!
  }

  return {
    Message: JSON.stringify({
      APNS_SANDBOX: JSON.stringify({
        aps: {'content-available': 1},
        file: clientFile
      }),
      default: 'Default message'
    }),
    MessageAttributes: {
      'AWS.SNS.MOBILE.APNS.PRIORITY': {DataType: 'String', StringValue: '5'},
      'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {
        DataType: 'String',
        StringValue: 'background'
      }
    },
    MessageStructure: 'json',
    TargetArn: targetArn
  }
}

export function assertIsError(error: unknown): asserts error is Error {
  logError('error', error)
  if (!(error instanceof Error)) {
    throw error
  }
}
