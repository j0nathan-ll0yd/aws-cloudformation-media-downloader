import {DynamoDBFile} from '#types/main'
import {FileStatus} from '#types/enums'
import {getRequiredEnv, getRequiredEnvNumber} from './env-validation'

export const defaultFile = {
  availableAt: Date.now(),
  size: getRequiredEnvNumber('DefaultFileSize'),
  authorName: 'Lifegames',
  description: 'Description',
  fileId: 'default',
  publishDate: new Date().toISOString(),
  key: getRequiredEnv('DefaultFileName'),
  url: getRequiredEnv('DefaultFileUrl'),
  contentType: getRequiredEnv('DefaultFileContentType'),
  authorUser: 'sxephil',
  status: FileStatus.Downloaded,
  title: 'Welcome! Tap to download.'
} as DynamoDBFile
