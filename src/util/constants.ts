import {DynamoDBFile} from '../types/main'

export const defaultFile = {
  availableAt: Date.now(),
  size: parseInt(process.env.DefaultFileSize as string, 10),
  authorName: 'Lifegames',
  description: 'Description',
  fileId: 'default',
  publishDate: new Date().toISOString(),
  key: process.env.DefaultFileName,
  url: process.env.DefaultFileUrl,
  contentType: process.env.DefaultFileContentType,
  authorUser: 'sxephil',
  status: 'Downloaded',
  title: 'Welcome! Tap to download.'
} as DynamoDBFile
