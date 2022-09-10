import {DynamoDBFile} from '../types/main'

export const defaultFile = {
  availableAt: Date.now(),
  eTag: 'e6e62f442e5cfecea8b2fd4d5d5e20e8',
  size: parseInt(process.env.DefaultFileSize as string, 10),
  authorName: 'Lifegames',
  description: 'Description',
  fileId: 'default',
  publishDate: new Date().toISOString(),
  key: process.env.DefaultFileName,
  url: process.env.DefaultFileUrl,
  lastModified: new Date().toISOString(),
  storageClass: 'STANDARD',
  fileUrl: process.env.DefaultFileUrl,
  contentType: process.env.DefaultFileContentType,
  authorUser: 'sxephil',
  title: 'Welcome! Tap to download.'
} as DynamoDBFile
