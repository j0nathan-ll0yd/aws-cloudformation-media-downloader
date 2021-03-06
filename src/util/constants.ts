export const defaultFile = {
  availableAt: Date.now(),
  size: parseInt(process.env.DefaultFileSize, 10),
  authorName: 'Lifegames',
  fileId: 'default',
  publishDate: new Date().toISOString(),
  key: process.env.DefaultFileName,
  url: process.env.DefaultFileUrl,
  contentType: process.env.DefaultFileContentType,
  authorUser: 'sxephil',
  title: 'Welcome! Tap to download.'
}
