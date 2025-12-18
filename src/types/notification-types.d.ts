export type FileNotificationType = 'MetadataNotification' | 'DownloadReadyNotification'

export interface MetadataNotification {
  fileId: string
  key: string
  title: string
  authorName: string
  authorUser: string
  description: string
  publishDate: string
  contentType: string
  status: 'pending'
}

export interface DownloadReadyNotification {
  fileId: string
  key: string
  size: number
  url: string
}
