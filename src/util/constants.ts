import {DynamoDBFile} from '#types/main'
import {FileStatus} from '#types/enums'
import {getRequiredEnv, getRequiredEnvNumber} from './env-validation'

export const defaultFile = {
  fileId: 'default',
  size: getRequiredEnvNumber('DefaultFileSize'),
  authorName: 'Lifegames',
  authorUser: 'sxephil',
  publishDate: new Date().toISOString(),
  description: 'Description',
  key: getRequiredEnv('DefaultFileName'),
  url: getRequiredEnv('DefaultFileUrl'),
  contentType: getRequiredEnv('DefaultFileContentType'),
  title: 'Welcome! Tap to download.',
  status: FileStatus.Available
} as DynamoDBFile
